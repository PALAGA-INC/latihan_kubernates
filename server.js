const https = require('https')
const fileSystem = require('fs')
const options = {
  key: fileSystem.readFileSync('privatekey.pem'),
  cert: fileSystem.readFileSync('certificate.pem')
}


require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")

const Users = UserModels();
const Temp = TempModel();

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors());

app.use("/api/user", Routers());

let waObject = null


function Routers() {
  const router = express.Router();
  const { sendVerification, activationUser } = Controllers();

  router.post("/sendverification", sendVerification);
  router.post("/activationuser", activationUser);

  return router;
}

function Controllers() {
  
  const userCtrl = {
    sendVerification: async (req, res) => {
      try {
        if(waObject) {

          const {username, phone, password} = req.body;

          if(!username || !phone || !password) return res.status(422).json({msg: "please input all fields"})

          if(await Users.findOne({phone})) return res.status(409).json({msg: "this user already exists"})

          if(!func.validPassword(password)) return res.status(400).json({msg: "invalid password"})

          const userNumber = `62${phone}@c.us`
          const passwordHash = await bcrypt.hash(password, 12)
          const authcode = Math.floor( 1000 + Math.random() * 9000).toString()
          const authCodeHash = await bcrypt.hash(authcode, 12)
          const existsTemp = await Temp.find()

          if(existsTemp.length > 0) {
            await Temp.collection.updateMany({phone},{
              $set:{authcode: authCodeHash, password: passwordHash}
            })
          } else {
            await new Temp({
              username,
              phone,
              password: passwordHash,
              authcode: authCodeHash
            }).save()
          }

          const user = await Temp.findOne({phone})

          res.cookie("userId",jwt.sign({userId: user._id}, process.env.RANDOM_KEY, {
            expiresIn: "30000ms"
          }), 
            {
              httpOnly : true,
              path: "/api/user/activationuser",
              maxAge: 30000, // 30 detik,
              secure: true,
              sameSite: 'none'
            }
          )

          waObject
          .sendMessage(userNumber, `Hi your OTP is : (${authcode}) Do not share it with anyone, including service providers.`)
          .catch(err => {return res.status(500).json({msg: err})} )

          return res.status(200).json({msg: "Registration success please check your whatsapp account"})
        } else {
          return res.status(500).json({mg : "please wait whatsapp not connected"})
        }

    } catch (err) {
      return res.status(500).json({ msg: err });
    }
    },
    activationUser: async (req, res) => {
      try {

        const { userCode } = req.body
        if(!userCode) return res.status(422).json({msg: "please input all fields"})
        const {userId }= req.cookies

        console.log(userId)



        // jwt.verify(userId, process.env.RANDOM_KEY, async (err, user) => {

        //   const User = await Temp.findOne({id : user.id})
        //   const match = await bcrypt.compare(userCode, User.authcode)

        //   if(err || !match) {
        //     return res.status(400).json({msg: "invalid OTP"})


            
        //   }

        //   return res.status(200).json({msg : "kurasa berhasil"})

        // })
      } catch (err) {
        return res.status(500).json({ msg: err });
      }
    }
  };

  return userCtrl;
}

function TempModel() {
  const tempSchema = new mongoose.Schema({
    username: {
      type: String,
      required: true,
      trim: true
   },
   phone: {
      type: Number,
      required: true,
      trim: true
   },
   password: {
      type : String,
      required: true,
      trim: true
   },
   authcode: {
      type: String,
      required: true,
      trim: true
   }  
  })
  return mongoose.model("Temps", tempSchema)
}

function UserModels() {
  const userSchema = new mongoose.Schema(
    {
      username: {
        type: String,
        required: true,
        trim: true,
      },
      phone: {
        type: Number,
        required: true,
        trim: true,
      },
      password: {
        type: String,
        required: true,
        trim: true,
      },
      role: {
        type: Number,
        default: 0,
      },
      cart: {
        type: Array,
        default: [],
      },
    },
    {
      timestamps: true,
    }
  );

  return mongoose.model("Users", userSchema);
}



function Middlewares() {
  const userMiddleware = {
    waMid: async (req, res, next) => {
      
    },
  };

  return userMiddleware;
}

function WaCall () {

  const { Client, LocalAuth } = require("whatsapp-web.js");
        const qrCode = require("qrcode-terminal");

        const client = new Client({
          authStrategy: new LocalAuth(),
          puppeteer: {
            args: ["sandbox"],
          },
        })
        
        client.initialize()
        .catch(_ => console.log("connection intrupted"))

        client.on("qr", (qr) => {
          console.log("QR RECEIVED", qr);
          qrCode.generate(qr, { small: true });
        });

        client.on("authenticated", (session) => {
          console.log("whatshapp authenticated");
          console.log(session)
        });

        client.on("auth_failure", (msg) => {
          console.error("AUTHENTICATION FAILURE", msg);
        });

        client.on("ready", () => {
          console.log("connected to whatsapp we are ready to go");
          waObject = client;
        });
}

function Run() {
  const port = process.env.PORT || 443;
  https.createServer(options, app).listen(port, (err) => {
    if(err) throw err
    MongoCall()
    console.log(`secure server running on port ${port}`)
    WaCall()
  })
}

function MongoCall() {
  mongoose
  .connect(process.env.DB_CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("connected to mongodb"))
  .catch((e) => console.log(e));
}

class Others {
  validPassword = (payload) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#$@!%&*?])[A-Za-z\d#$@!%&*?]{8,30}$/;
    return passwordRegex.test(payload)
  }

  // createAccessKey = (payload) => {
  //   return jwt.sign(payload, process.env.ACCESS_KEY, {
  //      expiresIn: "15m"
  //   })
  // }

  // createRefreshKey = (payload) => {
  //   return jwt.sign(payload, process.env.REFRESH_KEY, {
  //     expiresIn: "7d"
  //   })
  // }

  // second30Jwt = (payload) => {
  //   return jwt.sign(payload, process.env.RANDOM_KEY, {
  //     expiresIn: "30000ms"
  //   })
  // }

  // second60Jwt = (payload) => {
  //   return jwt.sign(payload, process.env.RANDOM_KEY, {
  //     expiresIn: "60000ms"
  //   })
  // }

  // second30CookiesToken = (a,b,c,d) => {
  //   d.cookie(a,b,{
  //     httpOnly : true,
  //     path: c,
  //     maxAge: 30000, // 30 detik
  //   })
  // }
  // second60CookiesToken = (a,b,c,d) => {
  //   d.cookie(a,b,{
  //     httpOnly : true,
  //     path: c,
  //     maxAge: 60000, // 60 detik
  //   })
  // }



}
const func = new Others()

Run();



