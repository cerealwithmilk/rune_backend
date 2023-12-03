require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function generate_identifier() {  
    let identifier = "";
    const possible_characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < 12; i++) 
        identifier += possible_characters.charAt(Math.floor(Math.random() * possible_characters.length));

    return identifier;
}

async function generate_linkvertise_link(link) {
    // base 64 encode the link
    const encoded_link = Buffer.from(link).toString('base64');
    return `https://link-to.net/1048954/${Math.random() * 1000}/dynamic/?r=${encoded_link}`;    
}

async function request_verification(ip_address, captcha_token) {
    if (typeof ip_address !== 'string') 
        return { passed: false, reason: "Invalid IP address" };

    if (typeof captcha_token !== 'string')
        return { passed: false, reason: "Invalid captcha token" };

    const formData = new FormData();
    formData.append('secret', process.env.TURNSTILE_PRIVATE);
    formData.append('remoteip', ip_address);
    formData.append('response', captcha_token);

    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData
        });

        const turnstile_response = await response.json();

        switch (turnstile_response.success) {
            case true:
                return { passed: true, reason: "The Turnstile captcha request passed successfully" };
            case false:
                return { passed: false, reason: "The Turnstile captcha request failed" };
            default:
                return { passed: false, reason: "Something went wrong while verifying the Turnstile captcha request" };
        }
    } catch (err) {
        console.log(`[Turnstile]: ${err}`);
        return { passed: false, reason: "Something went wrong while verifying the Turnstile captcha request" };
    }
}

async function proxy_check(ip_address) {
    if (typeof ip_address !== 'string') 
        return { passed: false, reason: "Invalid IP address" };

    if (!ip_address.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/) && !ip_address.match(/^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i))
        return { passed: false, reason: "Invalid IP address" };

    try {
        const response = await fetch(`https://security.fluster.world/proxy/${ip_address}`, { method: 'GET' });
        const proxy_response = await response.json();
        console.log(ip_address, proxy_response)

        switch (proxy_response.proxy) {
            case false:
                return { passed: true, reason: "The IP address passed the proxy check" };
            case true:
                return { passed: false, reason: "The IP address failed the proxy check and can be considered an proxy" };
            default:
                return { passed: false, reason: "Something went wrong while verifying if the request is an proxy" };
        }

    } catch (err) {
        console.log(`[Turnstile]: ${err}`);
        return { status: false, reason: "Something went wrong while verifying if the request is an proxy" };
    }
}

module.exports = {
    request_verification,
    proxy_check,
    generate_identifier,
    generate_linkvertise_link
}