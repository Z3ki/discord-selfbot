import { changePresenceTool } from './discord/changePresence.js';

import { reactionManagerTool } from './discord/reactionManager.js';

import { joinServerTool } from './discord/joinServer.js';

import { leaveServerTool } from './discord/leaveServer.js';

import { memoryInspectTool } from './system/memoryInspect.js';
import { dockerExecTool } from './system/dockerExec.js';

// Combine all tools
export const tools = [
  changePresenceTool,
  reactionManagerTool,
  joinServerTool,
  leaveServerTool,
  memoryInspectTool,
  dockerExecTool,
];

// Tool registry for execution
export class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.registerTools();
  }

  registerTools() {
    tools.forEach((tool) => {
      this.tools.set(tool.name, tool);
    });
  }

  getTool(name) {
    return this.tools.get(name);
  }

  getAllTools() {
    return tools;
  }

  getToolsText() {
    // Group tools by category
    const categories = {
      COMMUNICATION: [],
      'DISCORD MANAGEMENT': [
        'change_presence',
        'reaction_manager',
        'join_server',
        'leave_server',
      ],
      SYSTEM: ['memory_inspect'],
      RELATIONSHIPS: [],
    };

    const sections = [];

    for (const [category, toolNames] of Object.entries(categories)) {
      const categoryTools = tools.filter((tool) =>
        toolNames.includes(tool.name)
      );
      if (categoryTools.length > 0) {
        const toolTexts = categoryTools.map((tool) => {
          const params = Object.entries(tool.parameters.properties || {})
            .map(([key, prop]) => {
              const required = tool.parameters.required?.includes(key)
                ? ' (required)'
                : ' (optional)';
              return `  ${key}: ${prop.type}${required}`;
            })
            .join('\n');

          return `${tool.name}: ${tool.description}\nParameters:\n${params}`;
        });

        sections.push(`--- ${category} ---\n${toolTexts.join('\n\n')}`);
      }
    }

    return sections.join('\n\n');
  }
}

export const toolRegistry = new ToolRegistry();
