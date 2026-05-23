import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const TRENDPULSE_API = process.env.TRENDPULSE_API_URL || "http://localhost:5000/api";

async function fetchAPI(path: string, options?: RequestInit) {
  const url = `${TRENDPULSE_API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`TrendPulse API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

const server = new McpServer({
  name: "trendpulse",
  version: "0.1.0",
  description: "TrendPulse MCP Server - GitHub trending analytics powered by CHAOSS health metrics. Query daily/weekly trending repos, compare projects, get AI summaries, and evaluate open source project health.",
});

server.tool(
  "get_trending",
  "Get GitHub trending repositories by time period",
  {
    period: z.enum(["daily", "weekly", "rising", "declining", "hottest"]).describe("Time period for trending data"),
  },
  async ({ period }) => {
    const data = await fetchAPI(`/trending/${period}`);
    const repos = Array.isArray(data) ? data : data.repos || [];
    const summary = repos.slice(0, 10).map((r: any) => ({
      name: r.name || r.full_name,
      url: r.url,
      stars: r.stars,
      language: r.language,
      description: r.description?.substring(0, 120) || "",
    }));

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          period,
          total: repos.length,
          top10: summary,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "search_repos",
  "Search GitHub repositories",
  {
    query: z.string().describe("Search keyword"),
  },
  async ({ query }) => {
    const data = await fetchAPI(`/search?q=${encodeURIComponent(query)}`);
    const repos = (data.repos || data || []).slice(0, 10).map((r: any) => ({
      name: r.full_name || r.name,
      url: r.url || r.html_url,
      stars: r.stars || r.stargazers_count,
      language: r.language,
      description: (r.description || "").substring(0, 150),
    }));

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ query, results: repos }, null, 2),
      }],
    };
  }
);

server.tool(
  "compare_repos",
  "Compare two GitHub repositories side by side",
  {
    repo1: z.string().describe("First repository (owner/repo)"),
    repo2: z.string().describe("Second repository (owner/repo)"),
  },
  async ({ repo1, repo2 }) => {
    const data = await fetchAPI(`/compare?repo1=${encodeURIComponent(repo1)}&repo2=${encodeURIComponent(repo2)}`);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(data, null, 2),
      }],
    };
  }
);

server.tool(
  "get_chaoss_health",
  "Evaluate open source project health using CHAOSS metrics with Goal-Question-Metric framework",
  {
    repos: z.array(z.string()).describe("List of repository names (owner/repo)"),
  },
  async ({ repos }) => {
    const data = await fetchAPI("/repos/chaoss-health", {
      method: "POST",
      body: JSON.stringify({ repos }),
    });

    const results = (data.results || []).map((r: any) => {
      if (!r) return null;
      const dims: Record<string, any> = {};
      if (r.dimensions) {
        for (const [key, dim] of Object.entries(r.dimensions) as [string, any][]) {
          dims[key] = {
            name: dim.name,
            score: dim.score,
            goal: dim.goal,
            question: dim.question,
            details: dim.details,
          };
        }
      }
      return {
        repo: r.name,
        overall_score: r.score,
        level: r.level,
        framework: r.framework,
        dimensions: dims,
        meta: r.meta,
      };
    }).filter(Boolean);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          framework: "CHAOSS",
          docs: "https://chaoss.community/",
          results,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "get_summary",
  "Generate an AI-style trend analysis report for GitHub trending repos",
  {
    period: z.enum(["daily", "weekly", "rising", "declining"]).describe("Time period to analyze"),
    tone: z.enum(["daily", "roast", "minimal"]).describe("Report tone: daily=日报, roast=吐槽, minimal=极简"),
  },
  async ({ period, tone }) => {
    const data = await fetchAPI(`/summary?period=${period}&tone=${tone}`);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(data, null, 2),
      }],
    };
  }
);

server.tool(
  "get_chaoss_metrics_info",
  "Get the CHAOSS metrics framework definition used by TrendPulse",
  {},
  async () => {
    const data = await fetchAPI("/chaoss/metrics");
    return {
      content: [{
        type: "text",
        text: JSON.stringify(data, null, 2),
      }],
    };
  }
);

server.tool(
  "get_repo_detail",
  "Get detailed information about a GitHub repository",
  {
    repo: z.string().describe("Repository name (owner/repo)"),
  },
  async ({ repo }) => {
    const data = await fetchAPI(`/repo/detail?repo=${encodeURIComponent(repo)}`);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(data, null, 2),
      }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("TrendPulse MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});