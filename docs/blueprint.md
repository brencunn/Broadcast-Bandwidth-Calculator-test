# **App Name**: Bandwidth Navigator

## Core Features:

- Circuit Creation: Create circuits with two endpoints and an optional midpoint, automatically generating corresponding segments.
- Bandwidth Limit Configuration: Set bandwidth limits for each segment of the circuit, with separate tabs for each segment.
- Service Routing: Define the source and destination nodes for each service within a circuit.
- Bandwidth Utilisation Calculation: Calculate bandwidth utilisation per segment based on the configured services.
- Utilisation Display: Display bandwidth utilisation results per segment in real-time.
- Service Management: A table of all Services that shows the source and destination Nodes of each service

## Style Guidelines:

- Primary color: A deep sky blue (#007BFF) to represent networks.
- Background color: Light gray (#F8F9FA) for a clean interface.
- Accent color: A bright orange (#FFA500) to highlight important information and actions.
- Body and headline font: 'Inter', a grotesque-style sans-serif font known for its legibility and clean design. This font will be used for both headings and body text for a consistent and modern feel.
- Use minimalist icons from a set like 'lucide-react' to represent circuit components, nodes, and services.
- Use Shadcn Tabs component to show 1 or 2 tabs for circuits without midpoints and circuits with midpoints, respectively
- Implement subtle transitions and animations to provide feedback on user interactions, such as adding services or updating bandwidth limits.