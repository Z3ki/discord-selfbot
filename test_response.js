// Quick test for response object
const response = {
  text: "Hello, this is a test response!",
  metadata: {
    provider: "test",
    model: "test-model"
  }
};

console.log("Response text:", response.text);
console.log("Response length:", response.text.length);
console.log("Full response:", response);