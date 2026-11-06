# BeadLoom

BeadLoom combines a bead chart with conversations that help a person draw and refine it.

## Language

**Chart**:
A bead grid with a chosen size and palette. Several chat sessions can work on the same chart.
_Avoid_: Conversation, session

**Chat session**:
A conversation about one chart, including reference photos, drawing requests, and tool results. A session keeps its chart association; starting another session does not duplicate or reset the chart.
_Avoid_: Chart, drawing version

**Drawing turn**:
One user request and the agent's resulting inspection, drawing, and response. Stopping a turn preserves drawing edits that have already completed.
