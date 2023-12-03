const express = require('express');

const keyauth = require('../modules/keyauth');
const turnstile = require('../modules/turnstile');

const userSchema = require('../models/user.model');

const router = express.Router();

const successResponse = (res, data) => res.status(200).json({ error: false, data });
const errorResponse = (res, message) => res.status(400).render('invalid_checkpoint', { what_happend: message });

router.use(async (req, res, next) => {
    const identifier = req.headers['CF-Connecting-IP'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
    req.identifier = identifier;

    // verifying the user data on the database
    const user_data = await userSchema.findOne({ ip_address: identifier });

    if (!user_data)
        return next();

    if (user_data.blacklisted)
        return res.status(403).render('blacklisted', { reason: user_data.blacklisted_reason, at: user_data.blacklisted_at, id: user_data.guid });

    if (user_data.strikes > 3) {
        const current_time = new Date();
        const blacklist_msg = "You were automatically blacklisted due to constant strikes on the system";

        if (user_data.license)
            await keyauth.blacklist_user(user_data.license, blacklist_msg);

        await user_data.updateOne({ blacklisted: true, blacklisted_reason: blacklist_msg, blacklisted_at: current_time });
        return res.status(403).render('blacklisted', { reason: blacklist_msg, at: current_time, id: user_data.guid });
    }

    // verifying if the user created a license back at time
    if (user_data.license) {
        const license_verification = await keyauth.request_verification(user_data.license);

        if (!license_verification.passed) {
            await user_data.deleteOne();
            return res.status(200).redirect('/checkpoint');
        }
    }
    
    next();
});

router.get('/', async (req, res) => {
    const identifier = req.headers['CF-Connecting-IP'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
    const previous_checkpoint_data = await userSchema.findOne({ ip_address: identifier});

    if (previous_checkpoint_data)
        return res.redirect(`/checkpoint/progress/${previous_checkpoint_data.current_checkpoint}`);
    else
        return res.redirect('/checkpoint/progress/1');
});

router.get('/progress/:checkpoint', async (req, res) => {    
    const checkpoint = parseInt(req.params.checkpoint);
    const checkpoint_data = await userSchema.findOne({ ip_address: req.identifier });

    // rendered map of checkpoints
    const checkpoint_renders = {
        1: () => res.render('checkpoint', { checkpoint: 1 }),
        2: () => res.render('checkpoint', { checkpoint: 2 }),
        3: () => res.render('checkpoint', { checkpoint: 3 }),
        4: () => res.status(200).redirect('/checkpoint/finished')
    }

    // sanity checks
    if (typeof checkpoint !== 'number' || isNaN(checkpoint))
        return res.status(400).render('invalid_checkpoint', { what_happend: "You are on a non-existing checkpoint" })

    if (checkpoint < 1 || checkpoint > 4 || checkpoint % 1 !== 0)
        return res.status(400).render('invalid_checkpoint', { what_happend: "You are on an invalid checkpoint" })

    if (!checkpoint_renders[checkpoint])
        return res.status(400).redirect('/checkpoint');

    // redirecting to their proper checkpoint
    if (!checkpoint_data && checkpoint !== 1)
        return res.redirect('/checkpoint/progress/1');

    if (checkpoint_data && checkpoint_data.current_checkpoint !== checkpoint)
        return res.redirect(`/checkpoint/progress/${checkpoint_data.current_checkpoint}`);

    // handling whatsoever the render of the checkpoint

    return checkpoint_renders[checkpoint]();
});

router.post('/start', async (req, res) => {
    const identifier = req.headers['CF-Connecting-IP'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;

    let user_data = await userSchema.findOne({ ip_address: identifier });

    let turnstile_response = await turnstile.request_verification(identifier, req.body['cf-turnstile-response']);
    let twostep_linkvertise = await turnstile.generate_identifier();

    let id = await turnstile.generate_identifier();
    let linkvertise = await turnstile.generate_linkvertise_link(`https://sitetest1.fluster.world/checkpoint/arrived/${twostep_linkvertise}`);

    if (!turnstile_response.passed)
        return errorResponse(res, turnstile_response.reason);

    if (!user_data)
        user_data = await userSchema.create({ ip_address: identifier, current_checkpoint: 1, guid: id });

    await user_data.updateOne({ current_checkpoint_started: true, current_checkpoint_started_at: new Date(), current_checkpoint_2fa: twostep_linkvertise });
    return res.status(200).redirect(linkvertise);
});

router.get("/arrived/:stepverification", async (req, res) => {
    const referer = req.headers['referer'];
    const stepverification = req.params.stepverification;
    const identifier = req.headers['CF-Connecting-IP'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;

    // checking now on the user data
    const user_data = await userSchema.findOne({ ip_address: identifier });

    if (!user_data) 
        return errorResponse(res, "We didn't find any user data about you");    

    if (user_data.current_checkpoint > 4)
        return res.status(403).redirect('/checkpoint');

    if (!user_data.current_checkpoint_started) {
        await user_data.updateOne({ strikes: user_data.strikes + 1, current_checkpoint_started: false });
        return errorResponse(res, "You attempted to bypass the Linkvertise measures");
    }

    if ((new Date() - user_data.current_checkpoint_started_at) < 15000) {
        await user_data.updateOne({ strikes: user_data.strikes + 1, current_checkpoint_started: false });
        return errorResponse(res, "You attempted to bypass the Linkvertise measures");
    }

    // sanity checks on the request and checking if coming from linkvertise
    if (typeof stepverification !== 'string' || stepverification !== user_data.current_checkpoint_2fa) {
        await user_data.updateOne({ strikes: user_data.strikes + 1, current_checkpoint_started: false });    
        return errorResponse(res, "You attempted to bypass the Linkvertise measures");
    }

    if (typeof referer !== 'string' || referer !== "https://linkvertise.com/") {
        await user_data.updateOne({ strikes: user_data.strikes + 1, current_checkpoint_started: false });
        return errorResponse(res, "You attempted to bypass the Linkvertise measures");
    }

    // updating the user data
    const new_checkpoint = user_data.current_checkpoint + 1;
    await userSchema.findOneAndUpdate({ ip_address: identifier }, { current_checkpoint: new_checkpoint, current_checkpoint_started: false });

    return res.redirect(`/checkpoint/progress/${new_checkpoint}`);
});

router.get("/finished", async (req, res) => {
    const identifier = req.headers['CF-Connecting-IP'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;

    // sanity checks on the user data
    let user_data = await userSchema.findOne({ ip_address: identifier });

    if (!user_data)
        return res.status(403).redirect('/checkpoint');

    if (user_data.current_checkpoint !== 4)
        return res.status(403).redirect('/checkpoint');

    // proxy check

    const proxy_check = await turnstile.proxy_check(identifier);
    
    if (!proxy_check.passed) {
        await user_data.updateOne({ blacklisted: true, blacklisted_reason: "Using a proxy/vpn service to complete the checkpoint system is not allowed", blacklisted_at: new Date() });
        return res.status(403).render('blacklisted', { reason: "Using a proxy/vpn service to complete the checkpoint system is not allowed", at: new Date(), id: user_data.guid });
    }

    // license generation

    if (!user_data.license) {
        const creation = await keyauth.create_license(86400, `Rune Software - ${identifier}`);

        if (!creation.passed)
            return errorResponse(res, creation.reason);

        if (!creation.license.includes("RUNE-"))
            return errorResponse(res, "Something went wrong while creating an license key");

        user_data = await userSchema.findOneAndUpdate({ ip_address: identifier }, { license: creation.license });
        return res.status(200).render('uwu', { license: creation.license })
    }

    return res.status(200).render('uwu', { license: user_data.license })
});

module.exports = router;