// Used by index.ts for creating and accessing items stored in MySQL

import * as dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: `.env.local`, override: true });

import mysql from "mysql2/promise";
import { logError, log, colour, validCategories } from "./utilities";
import { Product, UpsertResponse, ProductResponse } from "./typings";

let connection: mysql.Connection;

export async function establishMySQL() {
  const MYSQL_CONFIG = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB_NAME,
  };

  try {
    connection = await mysql.createConnection(MYSQL_CONFIG);
    console.log("MySQL connection established.");

    // Create products table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        category JSON,
        sourceSite VARCHAR(255),
        size VARCHAR(255),
        unitPrice DECIMAL(10, 2),
        unitName VARCHAR(255),
        originalUnitQuantity INT,
        currentPrice DECIMAL(10, 2),
        priceHistory JSON,
        lastUpdated DATE,
        lastChecked DATE
      )`;
    await connection.query(createTableQuery);
  } catch (error) {
    throw new Error(`Failed to establish MySQL connection: ${error}`);
  }
}

export async function upsertProductToMySQL(scrapedProduct: Product): Promise<UpsertResponse> {
  try {
    const selectQuery = "SELECT * FROM products WHERE id = ?";
    const [rows] = await connection.execute(selectQuery, [scrapedProduct.id]);

    if (rows.length > 0) {
      const dbProduct = rows[0] as Product;
      const response = buildUpdatedProduct(scrapedProduct, dbProduct);

      const updateQuery = `
        UPDATE products SET
          name = ?,
          category = ?,
          sourceSite = ?,
          size = ?,
          unitPrice = ?,
          unitName = ?,
          originalUnitQuantity = ?,
          currentPrice = ?,
          priceHistory = ?,
          lastUpdated = ?
        WHERE id = ?`;

      await connection.execute(updateQuery, [
        response.product.name,
        JSON.stringify(response.product.category),
        response.product.sourceSite,
        response.product.size,
        response.product.unitPrice,
        response.product.unitName,
        response.product.originalUnitQuantity,
        response.product.currentPrice,
        JSON.stringify(response.product.priceHistory),
        response.product.lastUpdated,
        scrapedProduct.id,
      ]);

      return response.upsertType;
    } else {
      const insertQuery = `
        INSERT INTO products (
          id, name, category, sourceSite, size, unitPrice, unitName,
          originalUnitQuantity, currentPrice, priceHistory, lastUpdated, lastChecked
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      await connection.execute(insertQuery, [
        scrapedProduct.id,
        scrapedProduct.name,
        JSON.stringify(scrapedProduct.category),
        scrapedProduct.sourceSite,
        scrapedProduct.size,
        scrapedProduct.unitPrice,
        scrapedProduct.unitName,
        scrapedProduct.originalUnitQuantity,
        scrapedProduct.currentPrice,
        JSON.stringify(scrapedProduct.priceHistory),
        scrapedProduct.lastUpdated,
        scrapedProduct.lastChecked,
      ]);

      console.log(
        `  New Product: ${scrapedProduct.name.slice(0, 47).padEnd(47)}` +
          ` | $ ${scrapedProduct.currentPrice}`
      );

      return UpsertResponse.NewProduct;
    }
  } catch (e: any) {
    logError(e);
    return UpsertResponse.Failed;
  }
}

function buildUpdatedProduct(
  scrapedProduct: Product,
  dbProduct: Product
): ProductResponse {
  let dbDay = dbProduct.lastUpdated.toString();
  dbDay = dbDay.slice(0, 10);
  let scrapedDay = scrapedProduct.lastUpdated.toISOString().slice(0, 10);

  const priceDifference = Math.abs(
    dbProduct.currentPrice - scrapedProduct.currentPrice
  );

  if (priceDifference > 0.05 && dbDay !== scrapedDay) {
    dbProduct.priceHistory.push(scrapedProduct.priceHistory[0]);
    scrapedProduct.priceHistory = dbProduct.priceHistory;
    logPriceChange(dbProduct, scrapedProduct.currentPrice);
    return {
      upsertType: UpsertResponse.PriceChanged,
      product: scrapedProduct,
    };
  } else if (
    !dbProduct.category.every((category) => validCategories.includes(category)) ||
    dbProduct.category === null
  ) {
    console.log(
      `  Categories Changed: ${scrapedProduct.name
        .padEnd(40)
        .substring(0, 40)}` +
        ` - ${dbProduct.category.join(" ")} > ${scrapedProduct.category.join(
          " "
        )}`
    );

    scrapedProduct.priceHistory = dbProduct.priceHistory;
    scrapedProduct.lastUpdated = dbProduct.lastUpdated;

    return {
      upsertType: UpsertResponse.InfoChanged,
      product: scrapedProduct,
    };
  } else {
    dbProduct.lastChecked = scrapedProduct.lastChecked;
    return {
      upsertType: UpsertResponse.AlreadyUpToDate,
      product: dbProduct,
    };
  }
}

export function logPriceChange(product: Product, newPrice: number) {
  const priceIncreased = newPrice > product.currentPrice;
  log(
    priceIncreased ? colour.red : colour.green,
    "  Price " +
      (priceIncreased ? "Up   : " : "Down : ") +
      product.name.slice(0, 47).padEnd(47) +
      " | $" +
      product.currentPrice.toString().padStart(4) +
      " > $" +
      newPrice
  );
}
