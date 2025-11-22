const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Deploying DrugChain contract...");

  // Get the ContractFactory and Signers here.
  const DrugChain = await ethers.getContractFactory("DrugChain");
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy the contract
  console.log("Deploying...");
  const deployTx = await DrugChain.deploy();
  console.log("⏳ Transaction sent, waiting for confirmation...");
  
  // Wait for deployment and get transaction details
  const deployReceipt = await deployTx.deploymentTransaction().wait();
  await deployTx.waitForDeployment();

  const contractAddress = await deployTx.getAddress();
  const txHash = deployReceipt.hash;
  const gasUsed = deployReceipt.gasUsed.toString();
  const blockNumber = deployReceipt.blockNumber;
  
  console.log("✅ DrugChain deployed successfully!");
  console.log("📄 Transaction Hash:", txHash);
  console.log("📍 Contract Address:", contractAddress);
  console.log("⛽ Gas Used:", gasUsed);
  console.log("🔢 Block Number:", blockNumber);

  // Read the ABI from the compiled artifact
  const artifactPath = path.join(__dirname, '../artifacts/supply-chain-frontend/contracts/DrugChain.sol/DrugChain.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  
  // Get network information
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "hardhat" : network.name;
  const networkChainId = Number(network.chainId);
  
  // Save the contract address and ABI to a file for frontend use
  const contractInfo = {
    address: contractAddress,
    abi: artifact.abi,
    network: networkName,
    chainId: networkChainId
  };
  
  // Ensure the directory exists
  const outputDir = path.join(__dirname, '../supply-chain-frontend/src/utils');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, 'contract-info.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(contractInfo, null, 2)
  );
  
  console.log("✅ Contract info saved to:", outputPath);
  console.log("\n📝 Contract Details:");
  console.log("   Address:", contractAddress);
  console.log("   Network:", networkName);
  console.log("   Chain ID:", networkChainId);
  console.log("   Deployer:", deployer.address);
  console.log("   Transaction Hash:", txHash);
  console.log("   Gas Used:", gasUsed);
  console.log("   Block Number:", blockNumber);
  console.log("\n🔗 Explorer Links:");
  console.log("   Transaction: https://sepolia.etherscan.io/tx/" + txHash);
  console.log("   Contract: https://sepolia.etherscan.io/address/" + contractAddress);
  console.log("\n✅ ABI: Saved to contract-info.json");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

