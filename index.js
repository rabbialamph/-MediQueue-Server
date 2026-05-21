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
      const limit = req.query.limit;

      const query = email ? { ownerEmail: email } : {};

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



    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ Server error:", error);
  }
}

run();

app.get("/", (req, res) => {
  res.send("MediQueue Server Running 🚀");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
