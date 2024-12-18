import * as dotenv from "dotenv";
require('dotenv').config();  // Load the .env file

import axios from 'axios';
import { logError, log, colour, validCategories } from "./utilities";
import { Product, UpsertResponse, ProductResponse } from "./typings";

const FRAPPE_URL = process.env.FRAPPE_URL || 'http://besty.localhost:8000/api/resource/Product%20Item';
const FRAPPE_API_KEY = process.env.FRAPPE_API_KEY || '4d8f1dd1fa0910a';
const FRAPPE_API_SECRET = process.env.FRAPPE_API_SECRET || 'b429650f4233bde';

const FRAPPE_AUTH = {
  headers: {
    Authorization: `token ${FRAPPE_API_KEY}:${FRAPPE_API_SECRET}`
  }
};

export async function upsertProductToFrappe(scrapedProduct: Product): Promise<UpsertResponse> {
  try {
    const response = await axios.get(`${FRAPPE_URL}/${scrapedProduct.id}`, FRAPPE_AUTH);
    const dbProduct = response.data.data;

    const updateResponse = await axios.put(`${FRAPPE_URL}/${scrapedProduct.id}`, {
      data: {
        name: scrapedProduct.name,
        category: scrapedProduct.category,
        sourceSite: scrapedProduct.sourceSite,
        size: scrapedProduct.size,
        unitPrice: scrapedProduct.unitPrice,
        unitName: scrapedProduct.unitName,
        originalUnitQuantity: scrapedProduct.originalUnitQuantity,
        currentPrice: scrapedProduct.currentPrice,
        priceHistory: scrapedProduct.priceHistory,
        lastUpdated: scrapedProduct.lastUpdated,
        lastChecked: scrapedProduct.lastChecked,
      }
    }, FRAPPE_AUTH);

    return UpsertResponse.Updated;

  } catch (error) {
    if (error.response && error.response.status === 404) {
      const createResponse = await axios.post(FRAPPE_URL, {
        data: {
          id: scrapedProduct.id,
          name: scrapedProduct.name,
          category: scrapedProduct.category,
          sourceSite: scrapedProduct.sourceSite,
          size: scrapedProduct.size,
          unitPrice: scrapedProduct.unitPrice,
          unitName: scrapedProduct.unitName,
          originalUnitQuantity: scrapedProduct.originalUnitQuantity,
          currentPrice: scrapedProduct.currentPrice,
          priceHistory: scrapedProduct.priceHistory,
          lastUpdated: scrapedProduct.lastUpdated,
          lastChecked: scrapedProduct.lastChecked,
        }
      }, FRAPPE_AUTH);

      console.log(
        `  New Product: ${scrapedProduct.name.slice(0, 47).padEnd(47)}` +
          ` | $ ${scrapedProduct.currentPrice}`
      );

      return UpsertResponse.NewProduct;

    } else {
      logError(error);
      return UpsertResponse.Failed;
    }
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
