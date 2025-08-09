import express from 'express';
const app = express();

app.use(express.static('.'));      // serve everything in this folder
app.listen(8080, () => console.log('http://localhost:8080'));