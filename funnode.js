const express=require('express');
const app=express();
const fs=require('fs');
const jwt=require('jsonwebtoken')
const fspromises=require('fs').promises;
const path=require('path');
const PORT=3000;


app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static('./public'))

async function reader(filename){
try {
    const mrfile=path.join(__dirname,'views',filename)
    if(fs.existsSync(mrfile)){
        const data=await fspromises.readFile(mrfile,'utf8');
        if(mrfile.endsWith('.json')){
            return JSON.parse(data)
        } 
        else{
            return data
        }

    }
    else{
        return "OOOOPS😒"
    }
} catch (error) {
    console.log(error)
}
};



// const yah=async ()=>{
//     const result=await reader('me.json');
//     console.log(result)

// }

// yah()

app.get('/',(req,res)=>{
    
    res.sendFile(path.join(__dirname,'views','index.html'))
});

app.get('/signup',(req,res)=>{
res.sendFile(path.join(__dirname,'views','signup.html'))
})

app.get('/signin',(req,res)=>{
res.sendFile(path.join(__dirname,'views','signin.html'))
})

app.post('/addtask',async (req,res)=>{
    const result=await reader('me.json');
    console.log(result)
})

app.post('/health',(req,res)=>{
    res.status(200).json({message:"Working"})
})

app.use((req,res)=>{
    return res.status(404).json({message:"Page doesn't exist"})
})

app.listen(PORT,()=>{
    console.log(`App listening on PORT: ${PORT}`)
});

