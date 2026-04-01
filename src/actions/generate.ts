export const generate = async () => {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  console.log("Generating API client...");
  await sleep(2000);
  console.log("API client generated successfully!");
}