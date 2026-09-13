import { useState } from 'react'

/**
 * What a short enquiry form holds: the value of each field, the fault each one
 * is showing, and the `onChange` every field shares.
 *
 * A fault goes the moment its field is edited rather than once the edit has put
 * it right. The form's rules are asked again on the next send, so nothing is
 * judged while it is still being typed.
 *
 * @param {object|(() => object)} initial - The form as it opens, keyed by each
 *   field's `name`.
 * @returns {{ fields: object, setFields: Function, errors: object, setErrors: Function,
 *   change: (event: Event) => void }}
 */
export function useFormFields(initial) {
  const [fields, setFields] = useState(initial)
  const [errors, setErrors] = useState({})

  const change = event => {
    const { name, value } = event.target
    setFields(held => ({ ...held, [name]: value }))
    setErrors(current => {
      if (!current[name]) return current
      const rest = { ...current }
      delete rest[name]
      return rest
    })
  }

  return { fields, setFields, errors, setErrors, change }
}
