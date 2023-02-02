// Load environment variables
require("dotenv").config();

// Import library
const express = require("express");
var memjs = require('memjs')
const AWS = require('aws-sdk');

// Create AWS S3 client
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_ACCESS_KEY_SECRET
});
const bucket_name = process.env.AWS_BUCKET_NAME;

// Create memcached client
const client = memjs.Client.create()

// create express app
const app = express();

// Essential function to generate file key name from combination of host and request path
function generateKey(host, path) {
    // ? NOTE : S3 will only has the html files, all other assets will be served from cdn
    // Strip last slash if exists
    if(path.endsWith("/")){
        path = path.substring(0,path.length-1);
    }
    // handle root path
    if(path === ""){
        path = "/index.html";
    }
    // check whether the path has.html extension
    if(!path.endsWith(".html") && !path.endsWith(".ico")){
        path = `${path}.html`;
    }
    return `${host}${path}`;
}

// Wildcard route to handle all requests
app.get("*", async (req, res) => {
    try{
        // let host = req.get("host")
        let host = "tanmoy.portio.in";
        // generate key based on path and host combination
        const key = generateKey(host, req.path);
        // set content type
        res.set({
            "Content-Type": "text/html"
        });
        // check if data is present in cache
        const dataInCache = await client.get(key);
        if(dataInCache.value != null){
            // if exists send back data
            return res.send(dataInCache.value);
        }
        try{
            // else try to fetch from s3
            const file = await s3.getObject({
                Key: key,
                Bucket: bucket_name
            })
            .promise();
            const content = file.Body.toString();
            // set the data in cache with 24hr ttl
            await client.set(key, content, {expires: 24*3600});
            // send content
            res.send(content);
        }catch(err){
            // in case in s3 the content did not found return 404
            res.status(404).send("404 Not Found");
        }
    }catch(e){
        res.status(500).send("Unexpected Error");
    }
});


app.listen(3000, () => {
    console.log("Server started on port 3000");
})