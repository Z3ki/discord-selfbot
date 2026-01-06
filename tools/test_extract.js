import { extractToolCalls } from '../ai.js';

const sample = `create_website(name="site_js_css", html="<!DOCTYPE html><html><head><title>JS CSS Site</title><style>body{font-family:Arial;background:#f0f0f0;color:#333;}h1{color:#0066cc;}button{padding:10px 20px;background:#0066cc;color:white;border:none;border-radius:5px;cursor:pointer;}button:hover{background:#004999;}</style></head><body><h1>Welcome to the JS CSS Site</h1><p>This site uses JavaScript and CSS.</p><button id='myButton'>Click me</button><script>document.getElementById('myButton').addEventListener('click', function(){alert('Button clicked!');});</script></body></html>")`;

console.log('Input sample length:', sample.length);
const calls = extractToolCalls(sample);
console.log(JSON.stringify(calls, null, 2));
