require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function request_verification(license) {
    if (typeof license !== "string") 
        return { passed: false, reason: "The license is invalid" };
    
    if (!license.includes("RUNE-")) 
        return { passed: false, reason: "The license is invalid" };

    try {
        const response = await fetch(`https://keyauth.win/api/seller/?sellerkey=${process.env.KEYAUTH_SELLER_API}&type=verify&key=${license}`, { method: 'GET' });
        const license_response = await response.json();

        switch (license_response.success) {
            case true:
                return { passed: true, reason: "The license is valid" };
            case false:
                return { passed: false, reason: "The license is invalid" };
            default:
                return { passed: false, reason: "Something went wrong while verifying the license" };
        }
    } catch (err) {
        console.log(`[KeyAuth]: ${err}`);
        return { passed: false, reason: "Something went wrong while verifying the license" };
    }
}

async function create_license(expiration, note) {
    if (typeof expiration !== "number") 
        return { passed: false, reason: "The expiration is invalid" };

    if (typeof note !== "string") 
        return { passed: false, reason: "The note is invalid" };
    
    try {
        const response = await fetch(`https://keyauth.win/api/seller/?sellerkey=${process.env.KEYAUTH_SELLER_API}&type=add&format=JSON&expiry=${expiration}&mask=RUNE-****-****-****-****&level=1&amount=1&owner=SellerAPI&character=2&note=${note}`, { method: 'GET' });
        const license_response = await response.json();

        switch (license_response.success) {
            case true:
                return { passed: true, reason: "The license was created successfully", license: license_response.key };
            case false:
                return { passed: false, reason: "Something went wrong while creating the license" };
            default:
                return { passed: false, reason: "Something went wrong while creating the license" };
        }
    
    } catch (err) {
        console.log(`[KeyAuth]: ${err}`);
        return { passed: false, reason: "Something went wrong while creating the license" };
    }
}

async function blacklist_user(license, reason) {
    if (typeof license !== "string") 
        return { passed: false, reason: "The license is invalid" };

    if (!license.includes("RUNE-"))
        return { passed: false, reason: "The license is invalid" };

    if (typeof reason !== "string")
        return { passed: false, reason: "The reason is invalid" };
    
    try {
        const response = await fetch(`https://keyauth.win/api/seller/?sellerkey=${process.env.KEYAUTH_SELLER_API}&type=ban&key=${license}&reason=${reason}&userToo=0`);
        const license_response = await response.json();

        switch (license_response.success) {
            case true:
                return { passed: true, reason: "The license was blacklisted successfully" };
            case false:
                return { passed: false, reason: "Something went wrong while blacklisting the license" };
            default:
                return { passed: false, reason: "Something went wrong while blacklisting the license" };
        }
    } catch (err) {
        console.log(`[KeyAuth]: ${err}`);
        return { passed: false, reason: "Something went wrong while blacklisting the license" };
    }
}

module.exports = {
    request_verification,
    create_license,
    blacklist_user
}