#!/usr/bin/env node
/**
 * Vendor-only tool: signs a new MHTS ERP license file with the Ed25519
 * PRIVATE key (never committed to this repo, never bundled into the shipped
 * app — see docs/MHTS-ERP_Phase_Tracker.md's Key Decisions Log for where it
 * lives). Run this manually, on a machine you trust, whenever a real
 * customer needs a license issued or renewed.
 *
 * Usage:
 *   node scripts/generate-license.mjs \
 *     --privateKey=/path/to/mhts-license-private-key.pem \
 *     --issuedTo="Acme Traders Pvt Ltd" \
 *     --brand=MHTSdigiXR \
 *     --edition=STANDARD \
 *     --maxCompanies=unlimited \
 *     --expiresAt=never \
 *     --out=acme-traders.lic
 */
import { randomUUID, createPrivateKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) {
      args[match[1]] = match[2];
    }
  }
  return args;
}

function canonicalPayloadBytes(payload) {
  const ordered = {
    licenseId: payload.licenseId,
    issuedTo: payload.issuedTo,
    brand: payload.brand,
    edition: payload.edition,
    maxCompanies: payload.maxCompanies,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
  return Buffer.from(JSON.stringify(ordered), 'utf8');
}

const args = parseArgs();
const required = ['privateKey', 'issuedTo', 'brand', 'edition', 'maxCompanies', 'expiresAt', 'out'];
const missing = required.filter((key) => !(key in args));
if (missing.length > 0) {
  console.error(`Missing required arguments: ${missing.map((m) => `--${m}`).join(', ')}`);
  console.error('See the usage comment at the top of this script.');
  process.exit(1);
}

const privateKeyPem = readFileSync(args.privateKey, 'utf8');
const privateKey = createPrivateKey(privateKeyPem);

const payload = {
  licenseId: randomUUID(),
  issuedTo: args.issuedTo,
  brand: args.brand,
  edition: args.edition,
  maxCompanies: args.maxCompanies === 'unlimited' ? null : Number(args.maxCompanies),
  issuedAt: new Date().toISOString().slice(0, 10),
  expiresAt: args.expiresAt === 'never' ? null : args.expiresAt,
};

const signature = sign(null, canonicalPayloadBytes(payload), privateKey).toString('base64');

writeFileSync(args.out, JSON.stringify({ payload, signature }, null, 2));
console.log(`License written to ${args.out}`);
console.log(payload);
