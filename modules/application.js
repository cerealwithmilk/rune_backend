require('dotenv').config();

const helmet = require('helmet');
const express = require('express');
const mongoose = require('mongoose');
const bodyparser = require('body-parser');

// preset responses for the application
const unsupportedBrowser = (res) => res.status(403).json({ error: true, message: "Your browser is not supported for connecting to this resource, try using a different browser such as Google Chrome" });
const unsupportedExtensions = (res) => res.status(403).json({ error: true, message: "Your browser is attempting to do non common connections to this resource, are you sure you are not using any library for HTTP connections?" })

// setting up the application
const application = express();

application.set('view engine', 'ejs');
application.use(helmet({ contentSecurityPolicy: false }));

application.use(bodyparser.urlencoded({ extended: true }));
application.use(bodyparser.json());

application.use(express.static('public'));

// middleware
application.use((req, res, next) => {
    const accepts = req.headers['accept'];
    const userAgent = req.headers['user-agent'];
    const identifier = req.headers['CF-Connecting-IP'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;

    if (typeof accepts !== 'string' || typeof userAgent !== 'string' || typeof identifier !== 'string') return unsupportedBrowser(res);
    if (!accepts.includes('text/html') || !userAgent.includes('Mozilla')) return unsupportedExtensions(res);

    next();
});

// start listening the application
mongoose.connect(process.env.MONGO_URI)
    .then(() => application.listen(process.env.PORT, () => console.log(`[rune]: Listening on port ${process.env.PORT}`)))
    .catch((err) => console.log(`[rune]: failed to start up the server (mongodb issue): ${err}`));

module.exports = application;