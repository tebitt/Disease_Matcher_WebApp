const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
app.use(express.static(__dirname));

const url = "INSERT MONGODB LINK HERE";
const dbName = 'INSERT DATABASE NAME HERE';

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
   res.setHeader('Content-Type', 'text/html');
   res.sendFile(__dirname + '/index.html');
});

app.post('/submit', async (req, res) => {
   const symptoms = req.body.symptoms;
   console.log(symptoms);
   if(symptoms.length === 0){
      res.send('No disease found.');
   }else{
   try {
      const client = await MongoClient.connect(url, { useNewUrlParser: true });
      const db = client.db(dbName);

      //Convert array of symptoms from input into a array of symptoms' ObjectId from the Symptom table
      const symptomIds = await Promise.all(symptoms.map(async (symptomName) => {
         const symptom = await db.collection('Symptom').findOne({ name: symptomName }, { _id: 1 });
         return symptom._id;
      }));
       
      //Find the ObjectId of Disease, which is called the snomed_id, inside the Snomed_Symptom table that matches with the ObjectIds inside the array, "symptomIds" and put all the snomed_id (ObjectId) into a array
      //Since we are using two table (the Symptom table and Snomed_Symptom table) we use the aggregate function.
      //This output array "matchingSnomedIds" is sorted in a descending order, which means the snomed_id which matches with the most symptoms inside the symptomIds will be first
      const matchingSnomedIds = await db.collection('Snomed_Symptom')
         .aggregate([
            { $match: { symptom_id: { $in: symptomIds } } },
            { $group: { _id: '$snomed_id', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
         ])
         .toArray();
      
      //This function returns the disease from the Snomed table using the ObjectId in the index[0] which is the one that matches with most symptoms from the input
      const matchingSnomed = await db.collection('Snomed').findOne({ _id: new ObjectId(matchingSnomedIds[0]._id) });
      //This functions returns all the medicine_id which is the ObjectId of each medicine that matches with the disease defined by the Snomed_Medicine table relationship
      const medicineIds = await db.collection('Snomed_Medicine').distinct('medicine_id', { snomed_id: new ObjectId(matchingSnomed._id) });
      //Lastly return the all medicines which have matching ObjectId with the medicineIds and put them into an array
      const medicines = await db.collection('Medicine').find({ _id: { $in: medicineIds } }).toArray();

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
               <title>Matching Disease</title>
            </head>
            <body>
               <h1>Matching Disease:</h1>
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
   }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
   console.log(`Server running on port ${port}`);
});