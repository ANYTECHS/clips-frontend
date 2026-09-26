# React Patterns

## Overview

This reference guide provides comprehensive information for senior frontend.

## Patterns and Practices

### Pattern 1: Best Practice Implementation

**Description:**
Detailed explanation of the pattern.

**When to Use:**
- Scenario 1
- Scenario 2
- Scenario 3

**Implementation:**
```typescript
// Example code implementation
export class Example {
  // Implementation details
}
```

**Benefits:**
- Benefit 1
- Benefit 2
- Benefit 3

**Trade-offs:**
- Consider 1
- Consider 2
- Consider 3

### Pattern 2: Advanced Technique

**Description:**
Another important pattern for senior frontend.

**Implementation:**
```typescript
// Advanced example
async function advancedExample() {
  // Code here
}
```

## Guidelines

### Code Organization
- Clear structure
- Logical separation
- Consistent naming
- Proper documentation

### Performance Considerations
- Optimization strategies
- Bottleneck identification
- Monitoring approaches
- Scaling techniques

### Security Best Practices
- Input validation
- Authentication
- Authorization
- Data protection

## Common Patterns

### Pattern A
Implementation details and examples.

### Pattern B
Implementation details and examples.

### Pattern C
Implementation details and examples.

## Anti-Patterns to Avoid

### Anti-Pattern 1
What not to do and why.

### Anti-Pattern 2
What not to do and why.

## Removing Unused Props

Components should only declare props they actually use. Unused props add noise to the component API, mislead consumers, and can hide dead code paths.

### Identifying Unused Props

- Search the component body for each destructured prop; if it is never referenced, it is unused.
- Check for props that are only forwarded to children that no longer exist.
- Watch for props left behind after a refactor (e.g. `onLegacyAction`, `initialValue`).
- Use TypeScript's `noUnusedLocals`/`noUnusedParameters` and ESLint's `react/no-unused-prop-types` to surface candidates.

### Removing Props Safely

1. Remove the prop from the component's props type/interface.
2. Remove it from the destructuring in the function signature.
3. Update every parent that passes the prop so the call site no longer supplies it.
4. Confirm no functionality is lost — the prop must not have driven behavior indirectly (e.g. via spread into a DOM node or a child).

```typescript
// Before
interface ButtonProps {
  label: string;
  onClick: () => void;
  legacyVariant?: string; // never used
}

function Button({ label, onClick, legacyVariant }: ButtonProps) {
  return <button onClick={onClick}>{label}</button>;
}

// After
interface ButtonProps {
  label: string;
  onClick: () => void;
}

function Button({ label, onClick }: ButtonProps) {
  return <button onClick={onClick}>{label}</button>;
}
```

### Linting for Prop Usage

- Enable `react/no-unused-prop-types` (eslint-plugin-react) to flag declared-but-unused props.
- Enable `@typescript-eslint/no-unused-vars` for destructured props.
- Treat these rules as errors in CI so unused props cannot be reintroduced.

### Documenting Component APIs

- Keep the props interface as the single source of truth for the component API.
- Add JSDoc comments to non-obvious props so consumers understand intent.
- When removing a prop, note the change in the component's changelog or migration notes.

## Tools and Resources

### Recommended Tools
- Tool 1: Purpose
- Tool 2: Purpose
- Tool 3: Purpose

### Further Reading
- Resource 1
- Resource 2
- Resource 3

## Conclusion

Key takeaways for using this reference guide effectively.
