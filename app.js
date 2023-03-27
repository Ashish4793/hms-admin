//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
var easyinvoice = require('easyinvoice');
const session = require("express-session");
const MongoStore = require('connect-mongo')(session);
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: process.env.PASSPORT_KEY,
    cookie : {
        expires : 2000000
    },
    store: new MongoStore({ mongooseConnection: mongoose.connection })
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.set("strictQuery", false);
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);

    } catch (error) {
        console.log(error);
        process.exit(1);
    }
};

const adminUserSchema = new mongoose.Schema({
    username: { type: String, unique: true, require: true },
    name: String,
    email: { type: String, unique: true },
    phnno: { type: String, unique: true },
    password: String,
});
adminUserSchema.plugin(passportLocalMongoose);



const consumerBookingSchema = new mongoose.Schema({
    bookingID: { type: String, unique: true },
    bookingDate: String,
    bookingName: String,
    bookingUphn: String,
    bookingUemail: String,
    bookindUsername: String,
    checkinDate: String,
    checkoutDate: String,
    RoomPTRF: String,
    DaysStay: String,
    RoomType: String,
    Status: String,
    Price: String,
});

const roomSchema = new mongoose.Schema({
    roomNo: { type: String, unique: true },
    roomStatus: String,
    resident: String,
    billingStatus: String,
    billAmount: String,
});

const guestSchema = new mongoose.Schema({
    name: String,
    govtID: { type: String, unique: true },
    checkInDate: String,
    gender: String,
    email: String,
    phnNo: String,
    guestRoom: String,
    guestStRoomType: String
});

const Admin = mongoose.model("Admin", adminUserSchema);
const Guest = mongoose.model("Guest", guestSchema);
const Room = mongoose.model("Room", roomSchema);
const consumerBooking = mongoose.model("consumerBooking", consumerBookingSchema);

passport.use(Admin.createStrategy());
passport.serializeUser(Admin.serializeUser());
passport.deserializeUser(Admin.deserializeUser());

app.get("/badcred", function (req, res) {
    res.render("alerts/badcred");
});


app.get("/logout", function (req, res) {
    if (req.isAuthenticated()) {
        req.logout(function (err) { });
        res.render("alerts/logoutsuc");
    } else {
        res.redirect("/login");
    }
});

app.get("/login", function (req, res) {
    res.render("login");
});

app.post("/login", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/badcred"
}), function (req, res) {
});

app.get("/register", function (req, res) {
    res.render("register");
});

app.post("/register", function (req, res) {
    const randomNo = Math.floor(10000 + Math.random() * 90000).toString();
    Admin.register({ username: randomNo, name: req.body.name, email: req.body.email, phnno: req.body.phnNo }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
        } else {
            res.render("alerts/registersuc", { id: randomNo });
        }
    });
});


app.get("/adminmanage", function (req, res) {
    if (req.isAuthenticated()) {
        Admin.findOne({ username: req.user.username }, function (err, foundUser) {
            if (!err) {
                res.render("adminmanage", { foundUser: foundUser });
            } else {
                console.log(err);
            }
        })
    } else {
        res.redirect("/login");
    }
});

app.get("/rooms", function (req, res) {
    if (req.isAuthenticated()) {
        if (req.user.username === process.env.ADMIN) {
            res.render("rooms");
        } else {
            res.render("alerts/unauth");
        }
    } else {
        res.redirect("/login");
    }
});

app.post("/rooms", function (req, res) {
    if (req.isAuthenticated()) {
        if (req.user.username === process.env.ADMIN) {
            const room = new Room({
                roomNo: req.body.roomno,
                roomStatus: "Vacant",
                resident: null,
                billingStatus: null,
                billAmount: null
            });

            room.save(function (err) {
                if (!err) {
                    res.render("alerts/addroomsuc");
                } else {
                    console.log(err);
                }
            });
        } else {
            res.render("alerts/unauth");
        }
    } else {
        res.redirect("/login");
    }
});

app.get("/onlinebookings", function (req, res) {
    if (req.isAuthenticated()) {
        consumerBooking.find({}, function (err, foundBookings) {
            res.render("onlinebookings", { bookingsFound: foundBookings })
        });
    } else {
        res.redirect("/login");
    }
});

app.get("/cancelbookings", function (req, res) {
    if (req.isAuthenticated()) {
        consumerBooking.find({}, function (err, foundBookings) {
            res.render("cancelbookings", { bookingsFound: foundBookings })
        });
    } else {
        res.redirect("/login");
    }
});


app.post("/cancelbookings", function (req, res) {
    if (req.isAuthenticated()) {
        consumerBooking.findOneAndUpdate({ bookingID: req.body.bookingid }, { Status: "Cancelled by Hotel" }, function (err) {
            if (!err) {
                res.render("alerts/cancelbooksuc");
            } else {
                console.log(err);
            }
        });
    } else {
        res.redirect("/login");
    }
});

app.get("/", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("dashboard");
    } else {
        res.redirect("/login");
    }

});


app.get("/checkin", function (req, res) {
    if (req.isAuthenticated()) {
        Room.find({ roomStatus: "Vacant" }, function (err, foundRooms) {
            res.render("checkin", { roomsFound: foundRooms });
        });
    } else {
        res.redirect("/login");
    }
});

app.get("/delinvoice", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("deleteInvoices");
    } else {
        res.redirect("/login");
    }
});
app.get("/checkout", function (req, res) {
    if (req.isAuthenticated()) {
        Room.find({ roomStatus: "Occupied" }, function (err, foundRooms) {
            res.render("checkout", { roomsFound: foundRooms });
        });
    } else {
        res.redirect("/login");
    }
});


app.get("/billing", function (req, res) {
    if (req.isAuthenticated()) {
        Room.find({ roomStatus: "Occupied", billingStatus: "Unpaid" }, function (err, foundRooms) {
            res.render("billing", { roomsFound: foundRooms });
        });
    } else {
        res.redirect("/login");
    }
});

app.get("/invoice", function (req, res) {
    res.render("invoice");
});

app.post("/billing", function (req, res) {
    if (req.isAuthenticated()) {
        Guest.findOne({ guestRoom: req.body.roomNum }, function (err, foundGuest) {
            var name = foundGuest.name;
            var email = foundGuest.email;
            var guestRoomType = foundGuest.guestStRoomType;
            var phoneNo = foundGuest.phnNo;
            var rndomNo = Math.floor(100000 + Math.random() * 900000);
            var invoice_id = rndomNo.toString();
            var cin = foundGuest.checkInDate;
            var todayDate = new Date().toISOString().slice(0, 10);
            var startDate = Date.parse(cin);
            var endDate = Date.parse(todayDate);
            var diff = new Date(endDate - startDate);
            var days = diff / 1000 / 60 / 60 / 24;
            var tariff = 0;
            
            if (days != 0) {
                if (guestRoomType === "Single Bedded") {
                    tariff = 1250;
                } else if (guestRoomType === "Double Bedded") {
                    tariff = 3000;
                } else {
                    tariff = 6000;
                }
            } else {
                if (guestRoomType === "Single Bedded") {
                    tariff = 1250;
                } else if (guestRoomType === "Double Bedded") {
                    tariff = 3000;
                } else {
                    tariff = 6000;
                }
            }
            var finalAmount = tariff * days;
            Room.findOneAndUpdate({ roomNo: req.body.roomNum }, { billingStatus: "Paid", billAmount: finalAmount}, function (err) {
                if (!err) {
                    console.log("Bill Paid");
                } else {
                    console.log(err);
                }
            });

            res.render("invoice", { custName: name, custphn: phoneNo, custEmail: email, iID: invoice_id, cin: cin, cout: todayDate, billAmount: tariff , days : days });

        });
    } else {
        res.redirect("/login");
    }
});


app.get("/roomstatus", function (req, res) {
    if (req.isAuthenticated()) {
        Room.find({}, function (err, foundRooms) {
            res.render("roomstatus", { roomsFound: foundRooms });
        });
    } else {
        res.redirect("/login");
    }
});

app.post("/checkout", function (req, res) {
    if (req.isAuthenticated()) {
        Room.findOne({ roomNo: req.body.roomNum }, function (err, foundRoom) {
            if (foundRoom.billingStatus === "Paid") {
                Room.findOneAndUpdate({ roomNo: req.body.roomNum }, { roomStatus: "Vacant", resident: null, billingStatus: null, billAmount: null }, function (err) {
                    if (!err) {
                        console.log("updated");
                    } else {
                        console.log(err);
                    }
                    Guest.findOneAndDelete({ guestRoom: req.body.roomNum }, function (err) {
                        if (!err) {
                            res.render("alerts/coutsuc")
                        } else {
                            console.log(err);
                        }
                    });
                });
            } else {
                res.render("alerts/couterr");
            }
        });
    } else {
        res.redirect("/login");
    }
});

app.post("/checkin", function (req, res) {
    if (req.isAuthenticated()) {
        const a = req.body.roomNum;
        let guestRoomType;
        if (a === "H-101" || a === "H-102" || a === "H-103") {
            guestRoomType = "Single Bedded";
        } else if (a === "P-201" || a === "P-202" || a === "P-203") {
            guestRoomType = "Double Bedded";
        } else {
            guestRoomType = "VIP Suite";
        }
        const guest = new Guest({
            name: req.body.name,
            govtID: req.body.govtID,
            checkInDate: req.body.checkInDate,
            gender: req.body.gender,
            email: req.body.email,
            phnNo: req.body.phone,
            guestRoom: req.body.roomNum,
            guestStRoomType: guestRoomType
        });

        Room.findOneAndUpdate({ roomNo: req.body.roomNum }, { roomStatus: "Occupied", resident: req.body.name, billingStatus: "Unpaid", billAmount: "---NILL---" }, function (err) {
            if (!err) {
                console.log("Room status updated");
            } else {
                console.log(err);
            }
        });

        guest.save(function (err) {
            if (!err) {
                res.render("alerts/cinsuc");
            } else {
                console.log(err);
            }
        });
    } else {
        res.redirect("/login");
    }
});




connectDB().then(() => {
    console.log("hmsDB CONNECTED SUCCESFULLY");
    app.listen(3000, () => {
        console.log("HMS-ADMIN Server STARTED on PORT 3000");
    })
});