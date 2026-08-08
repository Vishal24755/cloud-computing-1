const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');

const s3Client = new S3Client({});

exports.process = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    const srcBucket = record.s3.bucket.name;
    const srcKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    const destBucket = process.env.PROCESSED_BUCKET || srcBucket.replace('-uploads-', '-processed-');
    const destKey = `resized-${srcKey}`;

    console.log(`Processing ${srcKey} from ${srcBucket}...`);

    try {
      // 1. Get image from S3
      const getObjectParams = {
        Bucket: srcBucket,
        Key: srcKey,
      };
      
      const getResponse = await s3Client.send(new GetObjectCommand(getObjectParams));
      
      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of getResponse.Body) {
        chunks.push(chunk);
      }
      const imageBuffer = Buffer.concat(chunks);

      // 2. Process image with sharp (e.g., resize to 800px width)
      const resizedImageBuffer = await sharp(imageBuffer)
        .resize(800, null, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      // 3. Upload processed image
      const putObjectParams = {
        Bucket: destBucket,
        Key: destKey,
        Body: resizedImageBuffer,
        ContentType: 'image/jpeg'
      };

      await s3Client.send(new PutObjectCommand(putObjectParams));
      console.log(`Successfully resized and uploaded to ${destBucket}/${destKey}`);

    } catch (error) {
      console.error(`Error processing image ${srcKey}:`, error);
      throw error;
    }
  }
};
