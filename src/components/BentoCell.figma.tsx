import React from 'react'
import figma from '@figma/code-connect'
import { BentoCell } from './BentoCell'

// Figma component set: BentoCell (node 73:56) in the Rive-ReDesign file.
figma.connect(
  BentoCell,
  'https://www.figma.com/design/7IP95CwE2b9sYNvHzG3O1b/Rive-ReDesign?node-id=73-56',
  {
    props: {
      size: figma.enum('Size', {
        Small: 'small',
        Wide: 'wide',
        Large: 'large',
      }),
      // State=Featured maps to the featured prop; Default/Hover leave it undefined.
      featured: figma.enum('State', {
        Featured: true,
      }),
    },
    example: ({ size, featured }) => (
      <BentoCell
        size={size}
        featured={featured}
        eyebrow="USE CASE"
        title="Title goes here"
        href="#"
      />
    ),
  }
)
