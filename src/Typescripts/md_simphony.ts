import * as https from 'N/https';
import * as crypto from 'N/crypto';
import * as log from 'N/log';
import * as record from 'N/record';
import * as search from 'N/search';
import * as runtime from 'N/runtime';
import { USERNAME, PASSWORD, ORGNAME } from './constants';

const URL = 'https://simphony-home.mta4.oraclerestaurants.com';
const AUTH_URL = 'https://ors-idm.mta4.oraclerestaurants.com/oidc-provider/v1/oauth2';
const CLIENT_ID = 'QkxNLjUxNjU2MTBmLTI4MjgtNDcyYy1hMzJkLTdjMGIwYWJiMDA5YQ'

type Tokens = {
  idToken: string,
  accessToken: string,
  refreshToken: string,
}

/**
 * Get tokens from Simphony
 * Check https://docs.oracle.com/en/industries/food-beverage/simphony/omsstsg2api/authorize.html
 * for the get tokens flow.
 * @returns {Object} - Tokens
 */
export async function getTokens(): Promise<Tokens> {
  const { code_verifier, query: authorizeQuery } = await authorize();
  const code = await signIn(authorizeQuery);

  const payload = {
    grant_type: 'authorization_code',
    code_verifier: code_verifier,
    code: code,
    scope: 'openid',
    client_id: CLIENT_ID,
  };

  const response = await https.post.promise({
    url: `${AUTH_URL}/token`,
    body: payload,
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.code !== 200) {
    log.error('Failed to get tokens', response);
    throw new Error('Failed to get tokens');
  }

  const responseJson = JSON.parse(response.body);
  return {
    accessToken: responseJson.access_token,
    idToken: responseJson.id_token,
    refreshToken: responseJson.refresh_token,
  };
}

async function authorize() {
  const code_verifier = randomString(128);
  const code_challenge_builder = crypto.createHash({
    algorithm: crypto.HashAlg.SHA256
  });
  code_challenge_builder.update({ input: code_verifier });
  const code_challenge = code_challenge_builder.digest({ outputEncoding: crypto.Encoding.BASE_64_URL_SAFE });

  const query = {
    client_id: CLIENT_ID,
    scope: 'openid',
    response_type: 'code',
    redirect_uri: 'apiaccount://callback',
    state: 999,
    code_challenge_method: 'S256',
    code_challenge: code_challenge
  }

  const url = `${AUTH_URL}/authorize?${Object.entries(query).map(([key, value]) => `${key}=${value}`).join('&')}`;
  const response = await https.get.promise({
    url: url,
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.code !== 200) {
    log.error('url', url);
    log.error('Failed to authorize', response);
    throw new Error('Failed to authorize');
  }
  return {
    code_verifier,
    query,
  }
}

async function signIn(query: Object) {
  const payload = {
    username: USERNAME,
    password: PASSWORD,
    orgname: ORGNAME,
  }

  const cookie = Object.entries(query).map(([key, value]) => `${key}=${value}`).join('; ');

  const response = await https.post.promise({
    url: `${AUTH_URL}/signin`,
    body: payload,
    headers: {
      Accept: 'application/json',
      ContentType: 'application/x-www-form-urlencoded',
      Cookie: cookie,
    },
  });

  const responseJson = JSON.parse(response.body);

  if (responseJson.success) {
    const urlParams = responseJson.redirectUrl.split('?')[1].split('&')

    for (const param of urlParams) {
      const [key, value] = param.split('=');
      if (key === 'code') return value;
    }

  } else {
    log.error('Failed to sign in', response);
    throw new Error('Failed to sign in');
  }
}

function randomString(length: number) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

type MenuItemsResult = {
  locRef: string,
  curUTC: string,
  menuItems: MenuItem[],
}

export type MenuItem = {
  num: number,
  name: string,
  name2: string,
  majGrpNum: number,
  majGrpName: string,
  famGrpNum: number,
  famGrpName: string,
  locRef: string,
}

/**
 * Get menu items from Simphony
 * @param {string} token - Token
 * @throws {Error} - Failed to get menu items
 */
export async function simphonyGetMenuItems(token: string, locRef: string): Promise<MenuItemsResult> {
  const url = `${URL}/bi/v1/${ORGNAME}/getMenuItemDimensions`;
  const body = {
    applicationName: 'netsuite',
    locRef: locRef,
  }
  log.debug({ title: 'Get Menu Items', details: { url, body } });

  const response = await https.post.promise({
    url: url,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": 'application/json',
      "Accept": 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (response.code !== 200) {
    log.error('Failed to get menu items', response);
    log.error('Failed to get menu items', response.body);
    throw new Error('Failed to get menu items');
  }

  return JSON.parse(response.body) as MenuItemsResult;
}

type GuestChecksResult = {
  locRef: string,
  guestChecks: GuestCheck[],
}

export type GuestCheck = {
  locRef?: string,
  guestCheckId: number,
  clsdBusDt: string,
  chkNum: number,
  detailLines: {
    menuItem: {
      miNum: number,
    },
    discount: {
      dscNum: number,
      dscMiNum: number,
    },
    serviceCharge: {
      svcChgNum: number,
    },
    dspQty: number,
    dspTtl: number,
    aggTtl: number,
    doNotShowFlag?: boolean,
    tenderMedia: {
      tmedNum: number,
    },
  }[],
}

/**
 * Get guest checks from Simphony
 * @param {string} token - Token
 * @param {Date} date - Date
 * @throws {Error} - Failed to get guest checks
 */
export async function simphonyGetGuestChecks(token: string, date: Date, locRef: string): Promise<GuestChecksResult> {
  const url = `${URL}/bi/v1/${ORGNAME}/getGuestChecks`;
  const body = {
    applicationName: 'netsuite',
    busDt: date.toISOString().split('T')[0],
    locRef: locRef,
  }
  log.debug({ title: 'Get Guest Checks', details: { url, body } });

  const response = await https.post.promise({
    url: url,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": 'application/json',
      "Accept": 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (response.code !== 200) {
    log.error('Failed to get guest checks', response);
    log.error('Failed to get guest checks', response.body);
    throw new Error('Failed to get guest checks');
  }

  return JSON.parse(response.body);
}

export async function createOrUpdateNonInventoryItem(menuItem: MenuItem) {
  let item: record.Record;
  const externalId = menuItem.num;

  const rId = await findNonInventoryItemIdByExternalId(externalId);
  if (rId) {
    item = await record.load.promise({
      type: record.Type.NON_INVENTORY_ITEM,
      id: rId,
      isDynamic: true,
    });
  } else {
    log.debug({ title: 'Creating Non Inventory Item', details: menuItem });
    item = await record.create.promise({
      type: record.Type.NON_INVENTORY_ITEM,
      isDynamic: true,
    });
  }

  const mappedFields = {
    externalid: externalId,
    itemid: externalId,
    displayname: menuItem.name,
    salesdescription: menuItem.name2,
    class: await getOrCreateClass(menuItem.majGrpName),
    cseg_md_ob_fg: await getOrCreateFamilyGroup(menuItem.famGrpName),
    salestaxcode: runtime.envType === runtime.EnvType.SANDBOX ? 5 : 5,
    // location: await findOrCreateLocation(menuItem.locRef),
  }

  for (const field in mappedFields) {
    item.setValue({ fieldId: field, value: mappedFields[field] });
  }

  try {
    await item.save.promise();
  } catch (error) {
    log.error({ title: 'Failed to create item', details: error });
  }
}

/**
 * Create Cash Sale if it doesn't exist by checking external id
 * @param {Object} guestCheck - Guest Check
 * @throws {Error} - Failed to create cash sale
 */
export async function createCashSale(guestCheck: GuestCheck) {
  const cashSaleId = await findCashSaleByExternalId(guestCheck.guestCheckId);
  if (cashSaleId) {
    return;
  }

  const r = await record.create.promise({
    type: record.Type.CASH_SALE,
    isDynamic: true,
  });

  r.setValue({ fieldId: 'externalid', value: guestCheck.guestCheckId });

  const trandateComponent = guestCheck.clsdBusDt.split('-');
  const trandate = new Date(
    parseInt(trandateComponent[0]),
    parseInt(trandateComponent[1]) - 1,
    parseInt(trandateComponent[2])
  );
  r.setValue({ fieldId: 'trandate', value: trandate });
  r.setValue({ fieldId: 'entity', value: 9 });
  r.setValue({ fieldId: 'memo', value: guestCheck.chkNum });

  const locationId = await findOrCreateLocation(guestCheck.locRef);
  r.setValue({ fieldId: 'location', value: locationId });

  for (let i = 0; i < guestCheck.detailLines.length; i++) {
    const detailLine = guestCheck.detailLines[i];

    if (detailLine.discount && detailLine.doNotShowFlag === true) {
      continue;
    }

    let item: number | string | null = null;
    if (detailLine.menuItem) {
      item = await findNonInventoryItemIdByExternalId(detailLine.menuItem.miNum)
        ?? await findKitItemIdByExternalId(detailLine.menuItem.miNum)
        ?? await findInventoryItemIdByExternalId(detailLine.menuItem.miNum);
      if (item === null) {
        throw new Error(`Menu item not found: ${detailLine.menuItem.miNum}. Aborting cash sale creation with external id: ${guestCheck.guestCheckId}.`);
      }
    } else if (detailLine.discount) {
      // if (detailLine.dspTtl === detailLine.aggTtl) {
      //   continue; // Skip discount line if it's the same as the total. Check https://motiv-digital.atlassian.net/browse/NIP-893 for more info.
      // }

      item = await findNonInventoryItemIdByExternalId(detailLine.discount.dscMiNum)
        ?? await findKitItemIdByExternalId(detailLine.discount.dscMiNum)
        ?? await findInventoryItemIdByExternalId(detailLine.discount.dscMiNum);
      if (item === null) {
        throw new Error(`Discount not found: ${detailLine.discount.dscMiNum}. Aborting cash sale creation with external id: ${guestCheck.guestCheckId}.`);
      }
      const discountItem = await findDiscountItemIdByExternalId(detailLine.discount.dscNum);
      r.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_md_cs_disc', value: discountItem });
    } else if (detailLine.serviceCharge) {
      item = 29;
    } else if (detailLine.tenderMedia) {
    }

    if (item === null) {
      continue;
    }

    r.selectNewLine({ sublistId: 'item' });
    r.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: item });

    const dspQty = detailLine.dspQty == 0 ? (detailLine.dspTtl > 0 ? 1 : 0) : detailLine.dspQty;
    const quantity = detailLine.serviceCharge ? 1 : dspQty;
    r.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: quantity });

    let rate = "0";
    if (quantity == 0) {
      rate = "0";
    } else {
      rate = (detailLine.dspTtl / quantity).toFixed(2);
    }
    r.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: rate });
    r.commitLine({ sublistId: 'item' });
  }

  if (r.getLineCount({ sublistId: 'item' }) === 0) {
    return;
  }

  try {
    await r.save.promise();
  } catch (error) {
    log.error({ title: 'Failed to create cash sale', details: error });
  }
}

/**
 * Find non inventory item by external id
 * @param {string} externalId - External id
 */
export async function findNonInventoryItemIdByExternalId(externalId: string | number): Promise<string | null> {
  const s = await search.create.promise({
    type: record.Type.NON_INVENTORY_ITEM,
    filters: [
      ['externalid', 'is', externalId],
    ],
    columns: [
      'internalid',
    ],
  });

  const result = await s.run().getRange.promise({ start: 0, end: 1 });
  if (result.length) {
    return result[0].getValue('internalid') as string;
  }
  return null;
}

/**
 * Find kit item by external id
 * @param {string} externalId - External id
 */
export async function findKitItemIdByExternalId(externalId: string | number): Promise<string | null> {
  const s = await search.create.promise({
    type: record.Type.KIT_ITEM,
    filters: [
      ['externalid', 'is', externalId],
    ],
    columns: [
      'internalid',
    ],
  });

  const result = await s.run().getRange.promise({ start: 0, end: 1 });
  if (result.length) {
    return result[0].getValue('internalid') as string;
  }
  return null;
}

/**
 * Find Inventory Item by external id
 * @param {string} externalId - External id
 */
export async function findInventoryItemIdByExternalId(externalId: string | number): Promise<string | null> {
  const s = await search.create.promise({
    type: record.Type.INVENTORY_ITEM,
    filters: [
      ['externalid', 'is', externalId],
    ],
    columns: [
      'internalid',
    ],
  });

  const result = await s.run().getRange.promise({ start: 0, end: 1 });
  if (result.length) {
    return result[0].getValue('internalid') as string;
  }
  return null;
}

export async function findDiscountItemIdByExternalId(externalId: string | number): Promise<string | null> {
  const s = await search.create.promise({
    type: record.Type.DISCOUNT_ITEM,
    filters: [
      ['externalid', 'is', externalId],
    ],
    columns: [
      'internalid',
    ],
  });

  const result = await s.run().getRange.promise({ start: 0, end: 1 });
  if (result.length) {
    return result[0].getValue('internalid') as string;
  }
  return null;
}

/**
 * Find Cash Sale by external id
 * @param {string} externalId - External id
 */
export async function findCashSaleByExternalId(externalId: string | number): Promise<string | null> {
  const s = await search.create.promise({
    type: record.Type.CASH_SALE,
    filters: [
      ['externalid', 'is', externalId],
    ],
    columns: [
      'internalid',
    ],
  });

  const result = await s.run().getRange.promise({ start: 0, end: 1 });
  if (result.length) {
    return result[0].getValue('internalid') as string;
  }
  return null;
}

/**
 * Create or get class
 * @param {string} name - Name
 * @returns {number|string} - Internal id
 */
export async function getOrCreateClass(name: string): Promise<number | string> {
  const s = await search.create.promise({
    type: record.Type.CLASSIFICATION,
    filters: [
      ['name', 'is', name],
    ],
    columns: [
      'internalid',
    ],
  });

  const result = await s.run().getRange.promise({ start: 0, end: 1 });
  if (result.length) {
    return result[0].getValue('internalid') as string;
  }

  const r = await record.create.promise({
    type: record.Type.CLASSIFICATION,
    isDynamic: true,
  })

  r.setValue({ fieldId: 'name', value: name });

  return await r.save.promise();
}

/**
 * Create or get family group (custom record)
 * @param {string} name - Name
 * @returns {number|string} - Internal id
 */
export async function getOrCreateFamilyGroup(name: string): Promise<number | string> {
  const s = await search.create.promise({
    type: 'customrecord_cseg_md_ob_fg',
    filters: [
      ['name', 'is', name],
    ],
    columns: [
      'internalid',
    ],
  });

  const result = await s.run().getRange.promise({ start: 0, end: 1 });
  if (result.length) {
    return result[0].getValue('internalid') as string;
  }

  const r = await record.create.promise({
    type: 'customrecord_cseg_md_ob_fg',
    isDynamic: true,
  })

  r.setValue({ fieldId: 'name', value: name });

  return await r.save.promise();
}


/**
 * Find or create location
 * @param {string} name - Name
 * @returns {number|string} - Internal id
 */
export async function findOrCreateLocation(name: string): Promise<number | string> {
  const s = await search.create.promise({
    type: record.Type.LOCATION,
    filters: [
      ['name', 'is', name],
    ],
    columns: [
      'internalid',
    ],
  });

  const result = await s.run().getRange.promise({ start: 0, end: 1 });
  if (result.length) {
    return result[0].getValue('internalid') as string;
  }

  const r = await record.create.promise({
    type: record.Type.LOCATION,
    isDynamic: true,
  })

  r.setValue({ fieldId: 'name', value: name });

  return await r.save.promise();
}

/**
 * Get Symphony location references
 * @param {Array} locationIds - Location ids
 * @returns {Object} - Location references
 */
export async function getSymphonyLocRefs(locationIds: string[]): Promise<{ [key: string]: string }> {
  const s = await search.create.promise({
    type: record.Type.LOCATION,
    filters: [
      ['internalid', 'anyof', locationIds],
    ],
    columns: [
      'name',
    ],
  });

  const result = await s.run().getRange.promise({ start: 0, end: 1000 });
  const locRefs: { [key: string]: string } = {};
  for (let i = 0; i < result.length; i++) {
    locRefs[result[i].id] = result[i].getValue('name') as string;
  }
  return locRefs;
}

/**
 * Get all Symphony location references
 * @returns {Object} - Location references
 */
export async function getAllSymphonyLocRefs(): Promise<{ [key: string]: string }> {
  const s = await search.create.promise({
    type: record.Type.LOCATION,
    columns: [
      'name',
    ],
  });

  const result = await s.run().getRange.promise({ start: 0, end: 1000 });
  const locRefs: { [key: string]: string } = {};
  for (let i = 0; i < result.length; i++) {
    locRefs[result[i].id] = result[i].getValue('name') as string;
  }
  return locRefs;
}

type DiscountDimensionsResult = {
  locRef: string,
  discounts: Discount[],
}

export type Discount = {
  locRef: string,
  num: number,
  name: string,
  posPercent: number,
}

/**
 * Get discount dimensions from Simphony
 * @param {string} token - Token
 * @throws {Error} - Failed to get discount dimensions
 * @returns {Object} - Discount dimensions
 */
export async function simphonyGetDiscountDimensions(token: string, locRef: string): Promise<DiscountDimensionsResult> {
  const url = `${URL}/bi/v1/${ORGNAME}/getDiscountDimensions`;
  const body = {
    applicationName: 'netsuite',
    locRef: locRef,
  }
  log.debug({ title: 'Get Discount Dimensions', details: { url, body } });

  const response = await https.post.promise({
    url: url,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": 'application/json',
      "Accept": 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (response.code !== 200) {
    log.error('Failed to get discount dimensions', response);
    log.error('Failed to get discount dimensions', response.body);
    throw new Error('Failed to get discount dimensions');
  }

  return JSON.parse(response.body);
}

/**
 * Create or update a NetSuite discount non inventory item
 * @param {Object} discountDimension - Discount Dimension
 * @throws {Error} - Failed to create item
 */
export async function createOrUpdateDiscountItem(discountDimension: Discount) {
  let item: record.Record;
  const externalId = discountDimension.num;

  const rId = await findDiscountItemIdByExternalId(externalId);
  if (rId) {
    item = await record.load.promise({
      type: record.Type.DISCOUNT_ITEM,
      id: rId,
      isDynamic: true,
    });
  } else {
    log.debug({ title: 'Creating Discount Item', details: discountDimension });
    item = await record.create.promise({
      type: record.Type.DISCOUNT_ITEM,
      isDynamic: true,
    });
  }

  item.setValue({ fieldId: 'externalid', value: externalId });
  item.setValue({ fieldId: 'itemid', value: discountDimension.name });
  item.setValue({ fieldId: 'displayname', value: discountDimension.name });
  item.setText({ fieldId: 'rate', text: discountDimension.posPercent + '%' });
  item.setValue({ fieldId: 'nonposting', value: 'T' });

  try {
    const id = await item.save.promise();
    log.debug({ title: 'Discount Item Created', details: id });
  } catch (error) {
    log.error({ title: 'Failed to create item', details: error });
  }
}
