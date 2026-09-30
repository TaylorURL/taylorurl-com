/**
 * The Monday letter to a client whose invoice has gone a week unpaid.
 *
 * It is written the way Trenton would write it by hand: a greeting, what is
 * owed and where to pay it, what has happened to the site because of it, and
 * how to reach him. No sheet, no slab and no mark, because a letter about
 * money reads as a person writing, and the studio's frame reads as a system
 * that sent it.
 *
 * Every invoice the client owes past the week goes in the one letter, so a
 * client two months behind hears about both in a single message rather than
 * one each. The site line is there only where a site is actually offline over
 * it: a client whose site is exempt, or who has no site yet, is still owed the
 * reminder and is not told something that is not happening.
 *
 * Pure: the caller hands in the moment it is writing for, which is what lets
 * the check read a letter for a fixed day.
 */

import { BIO_NAME, BIO_PHONE } from './bio.js'
import { escapeHtml } from './escape.js'
import { owedSince } from '../billing/overdue.js'
import { formatInstant } from '../time/zone.js'

/** Where the letter comes from, and where a reply to it goes. */
export const REMINDER_FROM = `${BIO_NAME} <trenton@taylorurl.com>`
export const REMINDER_REPLY_TO = 'trenton@taylorurl.com'

const DOLLARS = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/** Cents as the dollars a sentence says them in. */
function money(cents) {
  return DOLLARS.format(cents / 100)
}

/** The day an invoice was owed, the way a person says it. */
function owedDay(invoice) {
  const owed = owedSince(invoice)
  return owed ? formatInstant(owed * 1000, { month: 'long', day: 'numeric' }) : 'recently'
}

/** What is still owed on an invoice. */
function owing(invoice) {
  return invoice.amount_remaining ?? invoice.amount_due ?? 0
}

/**
 * The name the letter opens on.
 *
 * The contact a record names where it names one, since a record can be a
 * business. Otherwise the first word of a two-word name that reads as a
 * person's. A business name, or anything else, gets a plain hello rather than
 * "Hi Speedway".
 *
 * @param {object} customer A Stripe customer.
 * @returns {string}
 */
export function greetingFor(customer) {
  const named = customer?.metadata?.contact_name || customer?.name || ''
  const words = String(named).trim().split(/\s+/).filter(Boolean)
  const person = customer?.metadata?.contact_name
    ? words.length >= 1
    : words.length === 2 && words.every(word => /^[A-Za-z][A-Za-z'-]*$/.test(word))
  return person ? `Hi ${words[0]},` : 'Hello,'
}

/** A list of names joined the way a sentence joins them. */
function joined(names) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * The sentence about one invoice.
 *
 * An emailed invoice had a due date and was simply not paid. One charged to a
 * card on file was owed the day it was raised, and it is open because the card
 * refused it, which is the thing the client can actually fix.
 */
function invoiceSentence(invoice) {
  const amount = money(owing(invoice))
  if (invoice.collection_method === 'charge_automatically') {
    return `Invoice ${invoice.number} for ${amount} from ${owedDay(invoice)} hasn't been paid, because the card on file didn't go through.`
  }
  return `Invoice ${invoice.number} for ${amount} was due ${owedDay(invoice)} and hasn't been paid.`
}

/**
 * The letter, as the subject and the two bodies a message carries.
 *
 * @param {{customer: object, invoices: object[], sites: string[]}} reminder
 *   The client, the invoices they owe past the week, and the sites offline over them.
 * @returns {{subject: string, text: string, html: string}}
 */
export function overdueReminder({ customer, invoices, sites = [] }) {
  const several = invoices.length > 1
  const subject = several
    ? `${invoices.length} invoices are past due`
    : `Invoice ${invoices[0].number} is past due`

  // Each paragraph is a list of lines, so a link can sit on a line of its own
  // rather than having a full stop read into it.
  const owed = several
    ? [
        "These invoices haven't been paid:",
        ...invoices.flatMap(invoice => [invoiceSentence(invoice), invoice.hosted_invoice_url]),
      ]
    : [invoiceSentence(invoices[0]), 'You can pay it here:', invoices[0].hosted_invoice_url]

  const paragraphs = [[greetingFor(customer)], owed]
  if (sites.length) {
    const yours =
      sites.length > 1 ? `Your websites, ${joined(sites)}, are` : `Your website, ${sites[0]}, is`
    const back = sites.length > 1 ? 'they come' : 'it comes'
    paragraphs.push([
      `${yours} offline until ${several ? 'these are' : "it's"} paid, and ${back} back up a few minutes after you pay.`,
    ])
  }
  paragraphs.push([
    `If you've already paid or have a question, reply to this email or call me at ${BIO_PHONE}.`,
  ])
  paragraphs.push([BIO_NAME, 'TaylorURL'])

  const text = paragraphs.map(lines => lines.join('\n')).join('\n\n')

  const line = value =>
    /^https?:\/\//.test(value)
      ? `<a href="${escapeHtml(value)}">${escapeHtml(value)}</a>`
      : escapeHtml(value)
  const html = [
    '<!doctype html><html><head><meta charset="utf-8"></head><body>',
    ...paragraphs.map(lines => `<p>${lines.map(line).join('<br>')}</p>`),
    '</body></html>',
  ].join('')

  return { subject, text, html }
}
