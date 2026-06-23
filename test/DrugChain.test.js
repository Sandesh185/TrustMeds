// Smart Contract Tests using Hardhat
// Run with: npm test (from repo root)
const { expect } = require("chai");
const { ethers } = require("hardhat");

async function futureExpiry() {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp + 365 * 24 * 60 * 60;
}

describe("DrugChain", function () {
  let drugChain;
  let owner;
  let manufacturer;
  let distributor;
  let customer;

  beforeEach(async function () {
    [owner, manufacturer, distributor, customer] = await ethers.getSigners();

    const DrugChainFactory = await ethers.getContractFactory("DrugChain");
    drugChain = await DrugChainFactory.deploy();
    await drugChain.waitForDeployment();

    await drugChain.connect(owner).authorizeManufacturer(manufacturer.address);
  });

  describe("Product Creation", function () {
    it("Should create a product", async function () {
      const productId = "PROD-001";
      const productName = "Test Drug";
      const manufacturerName = "Test Manufacturer";
      const productCode = "CODE-001";
      const category = "Pharmaceutical";
      const price = ethers.parseEther("1.0");
      const latitude = 12345678;
      const longitude = 98765432;

      const expiryDate = await futureExpiry();

      await expect(
        drugChain.connect(manufacturer).createProduct(
          productId,
          manufacturerName,
          productName,
          productCode,
          category,
          price,
          latitude,
          longitude,
          expiryDate,
          ""
        )
      ).to.emit(drugChain, "ProductCreated");

      const product = await drugChain.getProduct(productId);
      expect(product.productName).to.equal(productName);
      expect(product.manufacturerName).to.equal(manufacturerName);
      expect(product.currentOwner).to.equal(manufacturer.address);
    });

    it("Should reject product creation from unauthorized manufacturer", async function () {
      const unauthorized = customer;
      const expiryDate = await futureExpiry();
      await expect(
        drugChain.connect(unauthorized).createProduct(
          "PROD-002",
          "Unauthorized",
          "Test",
          "CODE-002",
          "Category",
          ethers.parseEther("1.0"),
          0,
          0,
          expiryDate,
          ""
        )
      ).to.be.revertedWith("Not an authorized manufacturer");
    });

    it("Should reject duplicate product IDs", async function () {
      const productId = "PROD-003";
      const expiryDate = await futureExpiry();
      await drugChain.connect(manufacturer).createProduct(
        productId,
        "Manufacturer",
        "Product",
        "CODE-003",
        "Category",
        ethers.parseEther("1.0"),
        0,
        0,
        expiryDate,
        ""
      );

      await expect(
        drugChain.connect(manufacturer).createProduct(
          productId,
          "Manufacturer",
          "Product 2",
          "CODE-004",
          "Category",
          ethers.parseEther("1.0"),
          0,
          0,
          expiryDate,
          ""
        )
      ).to.be.revertedWith("Product already exists");
    });
  });

  describe("Ownership Transfer", function () {
    beforeEach(async function () {
      const expiryDate = await futureExpiry();
      await drugChain.connect(manufacturer).createProduct(
        "PROD-TRANSFER",
        "Manufacturer",
        "Transfer Product",
        "CODE-TRANSFER",
        "Category",
        ethers.parseEther("1.0"),
        0,
        0,
        expiryDate,
        ""
      );
    });

    it("Should transfer ownership", async function () {
      const productId = "PROD-TRANSFER";

      await expect(
        drugChain.connect(manufacturer).transferOwnership(
          productId,
          distributor.address,
          "Transferred to Distributor"
        )
      ).to.emit(drugChain, "OwnershipTransferred");

      const product = await drugChain.getProduct(productId);
      expect(product.currentOwner).to.equal(distributor.address);
    });

    it("Should reject transfer from non-owner", async function () {
      await expect(
        drugChain.connect(customer).transferOwnership(
          "PROD-TRANSFER",
          customer.address,
          "Status"
        )
      ).to.be.revertedWith("Not the owner of this product");
    });
  });

  describe("Status Updates", function () {
    beforeEach(async function () {
      const expiryDate = await futureExpiry();
      await drugChain.connect(manufacturer).createProduct(
        "PROD-STATUS",
        "Manufacturer",
        "Status Product",
        "CODE-STATUS",
        "Category",
        ethers.parseEther("1.0"),
        0,
        0,
        expiryDate,
        ""
      );
    });

    it("Should update product status", async function () {
      const productId = "PROD-STATUS";
      const newStatus = "In Transit";

      await expect(
        drugChain.connect(manufacturer).updateStatus(productId, newStatus)
      ).to.emit(drugChain, "StatusUpdated");

      const product = await drugChain.getProduct(productId);
      expect(product.status).to.equal(newStatus);
    });

    it("Should reject status update from non-owner", async function () {
      await expect(
        drugChain.connect(customer).updateStatus("PROD-STATUS", "Delivered")
      ).to.be.revertedWith("Not the owner of this product");
    });
  });

  describe("Manufacturer Authorization", function () {
    it("Should authorize a manufacturer", async function () {
      const [, , , , newManufacturer] = await ethers.getSigners();

      await expect(
        drugChain.connect(owner).authorizeManufacturer(newManufacturer.address)
      ).to.emit(drugChain, "ManufacturerAuthorized");

      const isAuthorized = await drugChain.authorizedManufacturers(newManufacturer.address);
      expect(isAuthorized).to.be.true;
    });

    it("Should only allow owner to authorize manufacturers", async function () {
      const [, , , , newManufacturer] = await ethers.getSigners();

      await expect(
        drugChain.connect(manufacturer).authorizeManufacturer(newManufacturer.address)
      ).to.be.revertedWith("Only contract owner can perform this action");
    });

    it("Should revoke manufacturer authorization", async function () {
      await expect(
        drugChain.connect(owner).revokeManufacturer(manufacturer.address)
      ).to.emit(drugChain, "ManufacturerRevoked");

      const isAuthorized = await drugChain.authorizedManufacturers(manufacturer.address);
      expect(isAuthorized).to.be.false;
    });
  });

  describe("Product Verification", function () {
    beforeEach(async function () {
      const expiryDate = await futureExpiry();
      await drugChain.connect(manufacturer).createProduct(
        "PROD-VERIFY",
        "Manufacturer",
        "Verify Product",
        "CODE-VERIFY",
        "Category",
        ethers.parseEther("1.0"),
        0,
        0,
        expiryDate,
        ""
      );
    });

    it("Should verify authentic product", async function () {
      const isAuthentic = await drugChain.verifyProduct("PROD-VERIFY");
      expect(isAuthentic).to.be.true;
    });

    it("Should revert for non-existent product", async function () {
      await expect(
        drugChain.verifyProduct("NONEXISTENT")
      ).to.be.revertedWith("Product does not exist");
    });
  });
});
