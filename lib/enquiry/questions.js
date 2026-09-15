/**
 * What each enquiry form asks, in the words the sender read.
 *
 * The notice that lands in the inbox is a reading of a form somebody filled
 * in, and every label in it is a claim about what was put to them. Those
 * claims were written a second time in the endpoint and drifted from the page:
 * a field asking what you need was reported as a project type, a business name
 * as a business, and the free-text answer arrived under no label at all, so
 * the only way to know what question produced it was to open the live form.
 *
 * So the questions are written once here and both sides read them. The form
 * renders its labels from this file and the notice reports the same words
 * back, which is the only arrangement where rewording a field cannot leave the
 * inbox describing a form that no longer exists.
 *
 * Each form asks its own set, in its own order. A question a form never put to
 * the sender has no row in the notice at all, because there is no answer for
 * it to be missing.
 */

import { IS_SECOND_SITE } from '../site/current.js'

/** Asked the same way wherever an enquiry is taken. */
const NAME = 'Name'
const EMAIL = 'Email'

/**
 * What the one control that asks how to answer puts on the page, wherever it
 * sits. Both forms render it, so the wording is settled here rather than in
 * each set below.
 */
export const REPLY_QUESTIONS = {
  contactMethod: 'How should we get back to you?',
  phone: 'Phone number',
}

/**
 * The questions each form asks, keyed by the field the answer is sent under
 * and held in the order the form asks them, which is the order the notice
 * reads them back in.
 */
export const QUESTIONS = {
  // Two of the seven are asked differently on the second site, because it is
  // not selling a website to a business: the sender is a company rather than a
  // shop, and what they are answering about is the work rather than a site.
  // The keys and their order are the two sites' own, so a notice reads the same
  // way whichever form produced it.
  contact: {
    name: NAME,
    email: EMAIL,
    company: IS_SECOND_SITE ? 'Company name' : 'Business name',
    projectType: 'What you need',
    contactMethod: REPLY_QUESTIONS.contactMethod,
    phone: REPLY_QUESTIONS.phone,
    message: IS_SECOND_SITE ? 'What the work has to do' : 'What the site has to do',
  },
  tools: {
    name: NAME,
    email: EMAIL,
    message: 'What you need',
    contactMethod: REPLY_QUESTIONS.contactMethod,
    phone: REPLY_QUESTIONS.phone,
    // Not a question. A tool names itself on the way out, so the notice says
    // which one the sender was standing in rather than pretending they picked
    // it off a list.
    projectType: 'Which tool',
  },
  // The Start page asks the contact page's questions, of somebody who arrived
  // ready to begin, so the words are the contact page's own rather than a
  // second set that could drift from them. What separates the two is the form
  // name, which is what the figures read.
  //
  // The number is asked beside the email and marked optional on the page, and
  // the reply-method tiles sit under the pair. A page whose whole job is a way
  // to reach somebody asks for both ways and lets the sender say which.
  start: {
    name: NAME,
    company: IS_SECOND_SITE ? 'Company name' : 'Business name',
    email: EMAIL,
    phone: REPLY_QUESTIONS.phone,
    contactMethod: REPLY_QUESTIONS.contactMethod,
    message: IS_SECOND_SITE ? 'What the work has to do' : 'What the site has to do',
  },
}

/**
 * The questions one form asked.
 *
 * A form the set does not name falls back to the contact page's, which is what
 * the endpoint already treats an unrecognised form as and the fullest set of
 * the two, so a notice off an older form is over-labelled rather than blank.
 *
 * @param {string} form Which form was sent.
 * @returns {object} Field to question, in the order the form asks.
 */
export function questionsFor(form) {
  return QUESTIONS[form] || QUESTIONS.contact
}
