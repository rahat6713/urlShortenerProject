const urlModel = require("../Models/urlModel");
const validUrl = require('valid-url')
const shortId = require('shortid')
const redis = require('redis')
const { promisify } = require("util");

const redisClient = redis.createClient(
    19837,
    "redis-19837.c212.ap-south-1-1.ec2.cloud.redislabs.com",
    { no_ready_check: true }
);
redisClient.auth("ceul8MIokpMHPhOwDYe3DZENKHnI1D5z", function (err) {
    if (err) throw err;
});

redisClient.on("connect", async function () {
    console.log("Connected to Redis..");
});

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);

const isValid = function (value) {
    if (typeof value === 'undefined' || value === null) return false
    if (typeof value === 'string' && value.trim().length === 0) return false
    return true;
}

const createUrl = async function (req, res) {
    try {
        let data = req.body

        let { longUrl } = data

        if (Object.keys(data).length == 0) {
            return res.status(400).send({ status: false, msg: "request body can't be empty, BAD REQUEST" })
        }
        if (!isValid(longUrl)) {
            return res.status(400).send({ status: false, msg: "longUrl is required " })
        }
        if (!validUrl.isWebUri(longUrl)) {
            return res.status(400).send({ status: false, msg: "longUrl is not a valid url" })
        }
        let urlDetails = await GET_ASYNC(`${longUrl}`)
        let changeToObject = JSON.parse(urlDetails)
        if (changeToObject) {
            return res.status(200).send({ status: true, msg: "details fetched successfully", data: changeToObject })
        }
        let longUrlDetails = await urlModel.findOne({ longUrl })
        if (longUrlDetails) {
            await SET_ASYNC(`${longUrl}`, JSON.stringify(longUrlDetails), "EX", 60)
            return res.status(200).send({ status: true, msg: "data fetched successfully", data: longUrlDetails })
        }

        let urlCode = shortId.generate()

        let baseUrl = 'http://localhost:3000'
        let shortUrl = baseUrl + '/' + urlCode
        let urlToBeCreated = { urlCode: urlCode, longUrl, shortUrl: shortUrl }
        let createNewUrl = await urlModel.create(urlToBeCreated)
        return res.status(201).send({ status: true, msg: "url created successfully", data: createNewUrl })
    }
    catch (error) {
        console.log(error)
        res.status(500).send({ msg: error.message })
    }
}

const redirectUrl = async function (req, res) {
    try {
        let urlCode = req.params.urlCode

        if (!isValid(urlCode)) {
            return res.status(400).send({ status: false, msg: "urlCode is required" })
        }
        let urlDetails = await GET_ASYNC(`${urlCode}`)
        if (urlDetails) {
            let changeToObject = JSON.parse(urlDetails)
            return res.status(302).redirect(changeToObject.longUrl)
        }

        let url = await urlModel.findOne({ urlCode: urlCode })
        if (url) {
            await SET_ASYNC(`${urlCode}`, JSON.stringify(url), "EX", 60)
            return res.status(302).redirect(url.longUrl)
        }
        else {
            return res.status(404).send({ status: false, msg: "urlCode not exist" })
        }
    }
    catch (error) {
        console.log(error)
        res.status(500).send({ msg: error.message })
    }
}

module.exports = { createUrl, redirectUrl }