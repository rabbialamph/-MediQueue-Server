const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// JWT SETUP
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URI}/api/auth/jwks`)
);

// AUTH MIDDLEWARE
const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Forbidden" });
  }
};

async function run() {
  try {
    await client.connect();

    const db = client.db("MediQueue");
    const tutorsCollection = db.collection("tutors");
    const bookingCollection = db.collection("booking");

    app.post("/tutors", verifyToken, async (req, res) => {
      try {
        const tutor = req.body;

        const tutorData = {
          ...tutor,
          totalSlot: Number(tutor.totalSlot),
          hourlyFee: Number(tutor.hourlyFee),
        };

        const result = await tutorsCollection.insertOne(tutorData);

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });


app.get("/tutors", async (req, res) => {
  const email = req.query.email;
  const search = req.query.search;
  const startDate = req.query.startDate;
  const limit = req.query.limit;
  const query = {};

  if (email) {
    query.ownerEmail = email;
  }

  if (search) {
    query.tutorName = {
      $regex: search,
      $options: "i",
    };
  }

  if (startDate) {
    query.startDate = {
      $gte: startDate,
    };
  }
  let cursor = tutorsCollection.find(query);

  if (limit) {
    cursor = cursor.limit(parseInt(limit));
  }
  const result = await cursor.toArray();
  res.send(result);
});




    app.get("/tutors/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid ID" });
      }

      const result = await tutorsCollection.findOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

  
    app.patch("/tutors/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const updateData = {
        ...req.body,
      };

      if (updateData.totalSlot) {
        updateData.totalSlot = Number(updateData.totalSlot);
      }

      const result = await tutorsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      res.send(result);
    });


    app.delete("/tutors/:id", verifyToken, async (req, res) => {
      const id = req.params.id;

      const result = await tutorsCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });
    
    app.post("/booking", verifyToken, async (req, res) => {
      try {
        const booking = req.body;

        const tutor = await tutorsCollection.findOne({
          _id: new ObjectId(booking.tutorId),
        });

        if (!tutor) {
          return res.status(404).send({
            success: false,
            message: "Tutor not found",
          });
        }

        const totalSlot = Number(tutor.totalSlot);

        if (totalSlot <= 0) {
          return res.status(400).send({
            success: false,
            message: "No available slots left",
          });
        }

        const result = await bookingCollection.insertOne({
          ...booking,
          status: "confirmed",
        });

        await tutorsCollection.updateOne(
          { _id: new ObjectId(booking.tutorId) },
          { $inc: { totalSlot: -1 } }
        );

        res.send({
          success: true,
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });


    app.get("/booking", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = email ? { studentEmail: email } : {};

      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/booking/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            success: false,
            message: "Invalid ID",
          });
        }

        const booking = await bookingCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!booking) {
          return res.status(404).send({
            success: false,
            message: "Booking not found",
          });
        }

        if (booking.status === "cancelled") {
          return res.status(400).send({
            success: false,
            message: "Already cancelled",
          });
        }

        await bookingCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "cancelled" } }
        );

        if (booking.tutorId && ObjectId.isValid(booking.tutorId)) {
          await tutorsCollection.updateOne(
            { _id: new ObjectId(booking.tutorId) },
            { $inc: { totalSlot: 1 } }
          );
        }

        res.send({
          success: true,
          message: "Booking cancelled successfully",
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error(" Server error:", error);
  }
}

run();

app.get("/", (req, res) => {
  res.send("MediQueue Server Running");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});