import { Product } from './typings';

export const colour = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  crimson: '\x1b[38m',
  grey: '\x1b[90m',
  orange: '\x1b[38;5;214m',
};

// Console log with specified colour, then clear colour
export function log(colour: string, text: string) {
  const clear = '\x1b[0m';
  console.log(`${colour}%s${clear}`, text);
}

// Shorthand function for logging with red colour
export function logError(text: string) {
  log(colour.red, text);
}

// Takes 2 colours and flip-flops between them on each function call
//  is used for printing tables with better readability
let alternatingRowColour = false;
function getAlternatingRowColour(colourA: string, colourB: string) {
  if (alternatingRowColour) alternatingRowColour = false;
  else if (!alternatingRowColour) alternatingRowColour = true;

  return alternatingRowColour ? colourA : colourB;
}

// Log a single product in one row, using alternating colours for readability
export function logProductRow(product: Product) {
  const categories = product.category != null ? product.category?.join(', ') : '';
  log(
    getAlternatingRowColour(colour.cyan, colour.white),
    `${product.id.padStart(6)} | ${product.name.slice(0, 50).padEnd(50)} | ` +
      `${product.size?.slice(0, 16).padEnd(16)} | ` +
      `$ ${product.currentPrice.toString().padStart(4).padEnd(4)} | ${categories}`
  );
}

export function logTableHeader() {
  console.log(
    'ID'.padEnd(6) +
      ' | ' +
      'Name'.padEnd(50) +
      ' | ' +
      'Size'.padEnd(16) +
      ' | ' +
      'Price'.padEnd(6) +
      ' | Categories'
  );
  console.log(''.padEnd(120, '-'));
}

// Log a specific price change message,
//  coloured green for price reduction, red for price increase
export function logPriceChange(product: Product, newPrice: Number) {
  const priceIncreased = newPrice > product.currentPrice;
  log(
    priceIncreased ? colour.red : colour.green,
    'Price ' +
      (priceIncreased ? 'Increased: ' : 'Decreased: ') +
      product.name.slice(0, 47).padEnd(47) +
      ' - from $' +
      product.currentPrice +
      ' to $' +
      newPrice
  );
}