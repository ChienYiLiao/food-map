/**
 * Utils.gs — GAS 端工具函式
 */

function jsonRes(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateId(prefix) {
  const ts   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

function todayStr() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch(_) { return null; }
}

function getProp(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}
