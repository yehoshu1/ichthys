name: Bug Report

description: Report a bug or unexpected behavior

labels: [bug]

body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting a bug! Please fill out the information below to help us diagnose and fix the issue.

  - type: textarea
    id: description
    attributes:
      label: Description
      description: A clear and concise description of what the bug is.
    validations:
      required: true

  - type: textarea
    id: steps
    attributes:
      label: Steps to Reproduce
      description: Steps to reproduce the behavior.
      placeholder: |
        1. Run command `/something`
        2. Click on '...'
        3. See error
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
      description: What you expected to happen.
    validations:
      required: true

  - type: textarea
    id: actual
    attributes:
      label: Actual Behavior
      description: What actually happened.
    validations:
      required: true

  - type: dropdown
    id: component
    attributes:
      label: Component
      description: Which part of the system is affected?
      options:
        - Bot (commands, events, jobs)
        - Dashboard (web UI)
        - API
        - Database / Migrations
        - Docker / Deployment
        - Other
    validations:
      required: true

  - type: input
    id: version
    attributes:
      label: Version
      description: "What version are you running? (check `/info` or package.json)"
      placeholder: "0.1.0-beta.1"
    validations:
      required: true

  - type: textarea
    id: logs
    attributes:
      label: Relevant Logs
      description: Paste any relevant log output. This will be automatically formatted as code.
      render: shell

  - type: textarea
    id: environment
    attributes:
      label: Environment
      description: |
        - OS: [e.g., Ubuntu 22.04]
        - Node.js version: [e.g., 22.x]
        - PostgreSQL version: [e.g., 17]
        - Docker: [yes/no]
      render: markdown
