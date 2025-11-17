import { logger } from './utils/logger.js';

export class SubagentCoordinator {
  constructor(requestQueue, apiResourceManager, providerManager) {
    this.requestQueue = requestQueue;
    this.apiResourceManager = apiResourceManager;
    this.providerManager = providerManager;
    this.subagents = new Map(); // agentId -> subagent config
    this.taskRouter = new Map(); // taskType -> agentId[]
  }

  registerSubagent(agentId, capabilities, config = {}) {
    const subagent = {
      id: agentId,
      capabilities,
      status: 'idle',
      config: {
        model: config.model || 'models/gemma-3-27b-it',
        requestsPerMinute: config.requestsPerMinute || 10,
        requestsPerHour: config.requestsPerHour || 100,
        ...config,
      },
      instance: null,
      created: Date.now(),
    };

    this.subagents.set(agentId, subagent);

    for (const capability of capabilities) {
      if (!this.taskRouter.has(capability)) {
        this.taskRouter.set(capability, []);
      }
      this.taskRouter.get(capability).push(agentId);
    }

    this.apiResourceManager.setAgentQuota(
      agentId,
      subagent.config.requestsPerMinute,
      subagent.config.requestsPerHour
    );

    logger.info('Subagent registered', {
      agentId,
      capabilities,
      taskRouterSize: this.taskRouter.size,
    });
  }

  async delegateTask(taskType, taskData, priority = 'NORMAL') {
    logger.debug('Delegating task', {
      taskType,
      availableAgents: this.taskRouter.get(taskType),
    });
    const availableAgents = this.taskRouter.get(taskType) || [];

    for (const agentId of availableAgents) {
      const agent = this.subagents.get(agentId);
      if (
        agent.status === 'idle' &&
        this.apiResourceManager.canMakeRequest(agentId)
      ) {
        agent.status = 'busy';
        try {
          const result = await this.requestQueue.addSubagentTask(
            agentId,
            () => this.executeSubagentTask(agentId, taskData),
            priority
          );
          return result;
        } finally {
          agent.status = 'idle';
        }
      }
    }

    throw new Error(`No available subagents for task type: ${taskType}`);
  }

  async executeSubagentTask(agentId, taskData) {
    const agent = this.subagents.get(agentId);

    // Build specialized prompt based on agent capabilities
    let systemPrompt = '';
    if (agent.capabilities.includes('code_review')) {
      systemPrompt = `You are a senior code quality specialist and software engineer. Your task is to analyze the provided code for:

1. **Bugs and Logic Errors**: Identify any logical flaws, edge cases, or potential runtime errors
2. **Security Vulnerabilities**: Check for common security issues like injection, XSS, CSRF, etc.
3. **Best Practices**: Code style, performance optimizations, maintainability improvements
4. **Potential Issues**: Race conditions, memory leaks, error handling gaps

Provide a structured analysis with:
- Specific line numbers or code sections
- Severity levels (Critical, High, Medium, Low)
- Clear explanations and recommended fixes
- Code examples where helpful

Be thorough but concise. Focus on actionable insights.

Code to analyze:
${taskData.prompt}

Analysis:`;
    } else if (agent.capabilities.includes('performance_analysis')) {
      systemPrompt = `You are a senior performance optimization specialist. Your task is to analyze the provided code or system for performance bottlenecks and optimization opportunities.

Focus on:
1. **Algorithm Complexity**: Time/space complexity analysis, inefficient algorithms
2. **Memory Usage**: Memory leaks, excessive allocations, optimization opportunities
3. **I/O Operations**: Database queries, file operations, network calls that could be optimized
4. **Caching Strategies**: Where caching could improve performance
5. **Concurrency**: Race conditions, blocking operations, parallelization opportunities
6. **Resource Management**: Connection pooling, resource cleanup, efficient data structures

Provide a structured analysis with:
- Specific performance issues identified
- Impact assessment (High/Medium/Low)
- Concrete optimization recommendations
- Code examples for improvements
- Expected performance gains

Be specific and actionable. Include metrics where possible.

Code/System to analyze:
${taskData.prompt}

Performance Analysis:`;
    } else if (agent.capabilities.includes('ux_review')) {
      systemPrompt = `You are a senior UX/UI specialist with expertise in user experience design. Your task is to analyze the provided interface, feature, or user flow for UX improvements.

Evaluate:
1. **User Flow**: Clarity of navigation, logical progression, user goals alignment
2. **Interface Design**: Visual hierarchy, information architecture, accessibility
3. **Usability Issues**: Common pain points, confusing elements, error-prone interactions
4. **User Research Insights**: Potential user needs, behavior patterns, preferences
5. **Accessibility**: WCAG compliance, inclusive design, diverse user support
6. **Mobile/Responsive**: Cross-device compatibility, touch interactions
7. **Feedback & Communication**: Error messages, success states, loading indicators

Provide a structured analysis with:
- Specific UX issues identified
- Severity levels (Critical, High, Medium, Low)
- User impact assessment
- Concrete improvement recommendations
- Wireframe/mockup suggestions where helpful
- Prioritized action items

Focus on user-centered improvements that enhance satisfaction and efficiency.

Interface/Feature to analyze:
${taskData.prompt}

UX Analysis:`;
    } else if (agent.capabilities.includes('api_integration')) {
      systemPrompt = `You are a senior integration specialist with expertise in API design, microservices, and system integration. Your task is to analyze the provided integration scenario for best practices and potential issues.

Evaluate:
1. **API Design**: RESTful principles, endpoint structure, HTTP methods usage
2. **Data Flow**: Request/response handling, error management, data validation
3. **Security**: Authentication, authorization, data protection, rate limiting
4. **Reliability**: Error handling, retry logic, circuit breakers, monitoring
5. **Performance**: Caching, pagination, async processing, resource optimization
6. **Scalability**: Load balancing, horizontal scaling, database optimization
7. **Documentation**: API specs, usage examples, versioning strategy
8. **Testing**: Integration tests, mocking strategies, contract testing

Provide a structured analysis with:
- Integration architecture assessment
- Specific issues or improvements identified
- Security and reliability recommendations
- Performance optimization suggestions
- Implementation examples and code snippets
- Testing and monitoring strategies

Focus on production-ready, maintainable integration patterns.

Integration scenario to analyze:
${taskData.prompt}

Integration Analysis:`;
    } else if (agent.capabilities.includes('manim_animation')) {
      systemPrompt = `You are a Manim animation specialist with expertise in creating mathematical animations using the Manim library.

Your task is to create Manim Python code for animations based on user descriptions. Focus on:

1. **Scene Structure**: Proper Manim scene setup with construct() method
2. **Mathematical Objects**: Use appropriate Manim objects (Text, Circle, Square, etc.)
3. **Animations**: Apply suitable animation methods (Write, FadeIn, Transform, etc.)
4. **Timing**: Proper animation sequencing and timing
5. **Code Quality**: Clean, readable Python code with comments

Provide complete, runnable Manim code that can be executed directly. Include necessary imports and proper scene class structure.

Animation request: ${taskData.prompt}

Generate the complete Manim Python code:`;
    } else if (agent.capabilities.includes('code_generation')) {
      systemPrompt = `You are a senior software engineer and code generation specialist. Your task is to generate high-quality, production-ready code based on user requirements.

Focus on:
1. **Best Practices**: Clean code, proper naming, documentation
2. **Error Handling**: Appropriate exception handling and validation
3. **Efficiency**: Optimized algorithms and data structures
4. **Maintainability**: Modular, readable code structure
5. **Language-Specific Conventions**: Follow language idioms and standards

Generate complete, functional code with comments explaining key sections.

Code generation request: ${taskData.prompt}

Provide the complete code solution:`;
    } else {
      // Generic prompt for other capabilities
      systemPrompt = `You are a specialized AI assistant with expertise in ${agent.capabilities.join(', ')}.

Task: ${taskData.prompt}

Provide a detailed, helpful response:`;
    }

    const result = await this.providerManager.generateContent(systemPrompt);
    let responseText = result;

    // Handle enhanced response format
    if (typeof responseText === 'object' && responseText.text) {
      responseText = responseText.text;
    }
    this.apiResourceManager.recordRequest(agentId);

    // Truncate if too long to prevent issues
    const maxLength = 4000;
    if (
      responseText &&
      typeof responseText === 'string' &&
      responseText.length > maxLength
    ) {
      return (
        responseText.substring(0, maxLength) +
        '\n\n[Response truncated due to length]'
      );
    }

    return responseText || 'Error: No response generated by subagent';
  }

  getSubagentStatus(agentId) {
    const agent = this.subagents.get(agentId);
    return agent
      ? {
          id: agent.id,
          status: agent.status,
          capabilities: agent.capabilities,
          uptime: Date.now() - agent.created,
        }
      : null;
  }

  listSubagents() {
    return Array.from(this.subagents.entries()).map(([id, agent]) => ({
      id,
      capabilities: agent.capabilities,
      status: agent.status,
      uptime: Date.now() - agent.created,
    }));
  }

  unregisterSubagent(agentId) {
    const agent = this.subagents.get(agentId);
    if (agent) {
      for (const capability of agent.capabilities) {
        const agents = this.taskRouter.get(capability);
        if (agents) {
          const index = agents.indexOf(agentId);
          if (index > -1) agents.splice(index, 1);
        }
      }
      this.subagents.delete(agentId);
      logger.info('Subagent unregistered', { agentId });
    }
  }
}
