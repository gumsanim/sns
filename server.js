const express = require("express");
const path = require("path");
const app = express();
const bodyParser = require("body-parser");
const passport = require("passport");
const session = require("express-session");
const LocalStrategy = require("passport-local").Strategy;
require("dotenv").config();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(session({secret:"secretCode", resave: true, saveUninitialized: false}));
app.use(passport.initialize());
app.use(passport.session());


var db;

const MongoClient = require("mongodb").MongoClient;
MongoClient.connect(process.env.DB_URL,
function(err,res){
    if(err){
        return console.log("error");
    }
    db = res.db("react-nodejs-sns");
    console.log("db connected");
})

function loginCheck(req,res,next){
    if(req.user){
        next();
    } else {
        res.redirect("/fail");
    }
}

const http = require("http").createServer(app);
http.listen(process.env.PORT,function(){
    console.log("listening on 8080");
})

app.use(express.static(path.join(__dirname,"sns/build")))

app.get("/",function(req,res){
    res.sendFile(path.join(__dirname,"sns/build/index.html"))
})

app.get("*",function(req,res){
    res.sendFile(path.join(__dirname,"sns/build/index.html"))
})

app.post("/signup/duplicatecheck",function(req,res){
    db.collection("user").findOne({id:req.body.id},function(error,result){
        if(error) return console.log("error")
        console.log(result);
        res.send(result);
    })
})

app.post("/signup/create",function(req,res){
    console.log(req.body.id);
    console.log(req.body.pw1);

    var usercount;
    db.collection("user-count").findOne({name:"usercount"},function(error,result){
        usercount = result.count;
        db.collection("user").insertOne({_id:result.count+1 , id:req.body.id, pw:req.body.pw1},function(error,result){
            if(error) return console.log("error");
            console.log(result);
            db.collection("user-count").updateOne({name:"usercount"},{$inc:{count:1}},function(error,result){
                if(error) return console.log("error");
            })
        })
    })
    res.redirect("/");
})

app.post("/main",passport.authenticate("local",{
    failureRedirect: "/fail"
}),function(req,res){
    res.redirect("/main");
})

passport.use(new LocalStrategy({
    usernameField: 'id',
    passwordField: 'pw',
    session: true,
    passReqToCallback: false,
  }, function (inputId, inputPw, done) {
    //console.log(입력한아이디, 입력한비번);
    db.collection('user').findOne({ id: inputId }, function (error, result) {
      if (error) return done(error)
      if (!result) return done(null, false, { message: "id not found" })
      if (inputPw == result.pw) {
        return done(null, result)
      } else {
        return done(null, false, { message: 'wrong pw' })
      }
    })
  }));

  passport.serializeUser(function(user,done){
    done(null,user.id)
  });
  passport.deserializeUser(function(id,done){
      db.collection("user").findOne({id:id},function(error,result){
        done(null,result);
      })
  })

app.post("/main/getpost",loginCheck,function(req,res){
    db.collection("post").find().toArray(function(error,result){
        if(error) return console.log(error);
        res.send(result);
    });
})

app.post("/detail/getpost",loginCheck,function(req,res){
    var id = parseInt(req.body.id);
    db.collection("post").findOne({_id:id},function(error,result){
        if(error) return console.log(error);
        res.send(result);
    })
})

app.post("/write/addpost",loginCheck,function(req,res){
    console.log(req.user.id)
    console.log(req.body.title)
    console.log(req.body.content)
    let year = new Date().getFullYear();
    let month = new Date().getMonth()+1+"";
    let date = new Date().getDate()+"";
    if(month.length==1){
        month = "0"+month;
    }
    if(date.length==1){
        date = "0"+date;
    }
    let writtenDate = ""+year+month+date;
    db.collection("post-count").findOne({name:"postcount"},function(error,result){
        var count = result.count;
        db.collection("post").insertOne({
            _id: count+1,
            user:req.user.id,
            date:writtenDate,
            title:req.body.title,
            content:req.body.content,
            like: 0,
            likeUser: [],
            comment:[],
            commentUser:[]
        },function(error,result){
            if(error) return console.log(error);
            res.send("포스팅 완료");
            db.collection("post-count").updateOne({name:"postcount"},{$inc:{count:1}},function(error,result){
                if(error) return console.log(error);
                console.log(result);
            })
        })
    })
})


app.post("/detail/like",loginCheck,function(req,res){
    let id = parseInt(req.body.id);
    db.collection("post").findOne({_id:id},function(error,result){
        if(error) return console.log(error);
        if(result.likeUser.includes(req.user.id)){
           db.collection("post").updateOne({_id:id},{$inc:{like:-1}},function(error,result){
                if(error) return console.log(error);
                db.collection("post").updateOne({_id:id},{$pull:{likeUser:req.user.id}},function(error,result){
                    if(error) return console.log(error);
                })
           })
        } else {
            db.collection("post").updateOne({_id:id},{$inc:{like:1}},function(error,result){
                if(error) return console.log(error);
                db.collection("post").updateOne({_id:id},{$push:{likeUser:req.user.id}},function(error,result){
                    if(error) return console.log(error);
                })
           })   
        }
    })
})


app.post("/delete",loginCheck,function(req,res){
    let id = parseInt(req.body.id);
    db.collection("post").findOne({_id:id},function(error,result){
        if(error) return console.log(error);
        if(result.user==req.user.id){
            db.collection("post").deleteOne({_id:id},function(error,result){
                if(error) return console.log(error);
                res.send("삭제가 완료되었습니다.");
            })
        } else {
            res.send("삭제 권한이 없습니다.");
        }
    })
})
