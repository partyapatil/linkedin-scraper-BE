import mongoose from "mongoose";

const profileSchema = new mongoose.Schema({
  name: String,
  title: String,
  location: String,
  url: String,
});

export default mongoose.model("Profile", profileSchema);
