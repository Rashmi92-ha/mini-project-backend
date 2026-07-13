const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    //Check if authorization header exists
    if(!authHeader || !authHeader.startsWith("Bearer")){
        return res.status(401).json({
            message: "Access denied. No token provided.",
        });
    }

    //Extract token
    const token =  authHeader.split(" ")[1];
    try {
        // Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        //store decoded user information
        req.user = decoded;
        next();
    }catch(err){
        return res.status(401).json({
            message: "Invalid or expired token.",
        });
    }
};
module.exports = auth;