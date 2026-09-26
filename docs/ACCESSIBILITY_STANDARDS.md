# Accessibility Standards

Accessibility is treated as a first-class software quality gate. UI changes are expected to preserve keyboard accessibility, semantic labels, and screen-reader compatibility.

## Required checks

- Use semantic HTML landmarks and roles.
- Ensure every actionable control has an accessible name.
- Support keyboard navigation for all interactive controls.
- Validate color contrast and focus visibility.
- Add automated accessibility checks for major flows.

## Test strategy

The test suite includes:

- `axe-core` validations for DOM violations
- keyboard interaction checks for focus and activation
- screen-reader-friendly role and label assertions

## Validation

```bash
npm test -- --runInBand __tests__/accessibility/a11y.test.tsx
```

Contributors should run this suite whenever they adjust pages, forms, dialogs, or navigation state.
