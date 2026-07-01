import React from 'react'
import figma from '@figma/code-connect'
import { Button } from './Button'

// Figma component set: Button (node 47:20) in the Rive-ReDesign file.
figma.connect(
  Button,
  'https://www.figma.com/design/7IP95CwE2b9sYNvHzG3O1b/Rive-ReDesign?node-id=47-20',
  {
    props: {
      variant: figma.enum('Variant', {
        Primary: 'primary',
        Secondary: 'secondary',
        Ghost: 'ghost',
      }),
      // State=Disabled maps to the disabled prop; Default/Hover leave it undefined (omitted).
      disabled: figma.enum('State', {
        Disabled: true,
      }),
    },
    example: ({ variant, disabled }) => (
      <Button variant={variant} disabled={disabled}>
        Button
      </Button>
    ),
  }
)
