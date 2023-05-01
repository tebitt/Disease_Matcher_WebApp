const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(express.static('/Users/tebit/Desktop/Private/DB/'));

// Connection URL and database name
const url = "mongodb+srv://tebit:Nile%2332713@dbproject.eqmjmq7.mongodb.net/?retryWrites=true&w=majority";
const dbName = 'SnomedDB';

// Use body-parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve the HTML form on GET request to the root URL
app.get('/', (req, res) => {
   res.setHeader('Content-Type', 'text/html');
   res.sendFile('/Users/tebit/Desktop/Private/DB/index.html');
});

// Handle the form submission on POST request to the root URL
// Handle the form submission on POST request to the root URL
app.post('/submit', async (req, res) => {
   // Get the symptoms from the submitted form data
   const symptoms = req.body.symptoms;
   console.log(symptoms);

   try {
      // Connect to the database and find the matching diseases
      const client = await MongoClient.connect(url, { useNewUrlParser: true });
      const db = client.db(dbName);

      const symptomIds = await Promise.all(symptoms.map(async (symptomName) => {
         const symptom = await db.collection('Symptom').findOne({ name: symptomName }, { _id: 1 });
         return symptom._id;
      }));
       
      const matchingSnomedIds = await db.collection('Snomed_Symptom')
         .aggregate([
            { $match: { symptom_id: { $in: symptomIds } } },
            { $group: { _id: '$snomed_id', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
         ])
         .toArray();

      const matchingSnomed = await db.collection('Snomed').findOne({ _id: new ObjectId(matchingSnomedIds[0]._id) });
      const medicineIds = await db.collection('Snomed_Medicine').distinct('medicine_id', { snomed_id: new ObjectId(matchingSnomed._id) });
      const medicines = await db.collection('Medicine').find({ _id: { $in: medicineIds } }).toArray();

      // Display the matching diseases and their medicines
      console.log('Matching Diseases:');
      if (matchingSnomed) {
         console.log(`${matchingSnomed.name} (${matchingSnomed.description})`);
         console.log('Medicines:');
         medicines.forEach((medicine) => {
            console.log(`- ${medicine.name} (${medicine.description}) - Dosage: ${medicine.dosage}`);
         });
         const htmlResult = `
            <html>
            <head>
               <title>Matching Diseases</title>
            </head>
            <body>
               <h1>Matching Diseases:</h1>
               <div>
                  <h2>${matchingSnomed.name} (${matchingSnomed.description})</h2>
                  <p>Snomed Code: ${matchingSnomed.code}</p>
                  <ul>
                     ${medicines.map((medicine) => `
                        <li>${medicine.name} (${medicine.description})</li><li>Dosage: ${medicine.dosage}</li>
                     `).join('')}
                  </ul>
               </div>
            </body>
            </html>
         `;
         res.setHeader('Content-Type', 'text/html');
         res.send(htmlResult);
      } else {
         res.send('No disease found.');
      }}catch (err) {
      console.error(err);
   }
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
   console.log(`Server running on port ${port}`);
});