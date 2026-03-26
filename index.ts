import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsub = footerData.onBranchChange(() => tui.requestRender());

			return {
				dispose: unsub,
				invalidate() {},
				render(width: number): string[] {
					// Calculate cost from session
					let totalCost = 0;
					for (const entry of ctx.sessionManager.getBranch()) {
						if (entry.type === "message" && entry.message.role === "assistant") {
							const m = entry.message as AssistantMessage;
							totalCost += m.usage.cost.total;
						}
					}

					// Context usage
					const contextUsage = ctx.getContextUsage();
					const contextWindow = contextUsage?.contextWindow ?? 0;
					const contextPercent = contextUsage?.percent !== null ? contextUsage?.percent?.toFixed(1) : "?";
					const contextPercentValue = contextUsage?.percent ?? 0;

					const fmt = (n: number) => {
						if (n < 1000) return n.toString();
						if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
						if (n < 1000000) return `${Math.round(n / 1000)}k`;
						if (n < 10000000) return `${(n / 1000000).toFixed(1)}M`;
						return `${Math.round(n / 1000000)}M`;
					};

					// Context with color coding
					const contextDisplay = `${contextPercent}%/${fmt(contextWindow)}`;
					let contextStr: string;
					if (contextPercentValue > 90) {
						contextStr = theme.fg("error", contextDisplay);
					} else if (contextPercentValue > 70) {
						contextStr = theme.fg("warning", contextDisplay);
					} else {
						contextStr = contextDisplay;
					}

					const left = `$${totalCost.toFixed(3)}  ${contextStr}`;

					// Model + thinking on the right
					const modelName = ctx.model?.id || "no-model";
					let right = modelName;
					if (ctx.model?.reasoning) {
						const level = pi.getThinkingLevel() || "off";
						right = level === "off" ? `${modelName} • thinking off` : `${modelName} • ${level}`;
					}

					// pwd line
					let pwd = process.cwd();
					const home = process.env.HOME || process.env.USERPROFILE;
					if (home && pwd.startsWith(home)) {
						pwd = `~${pwd.slice(home.length)}`;
					}
					const branch = footerData.getGitBranch();
					if (branch) pwd = `${pwd} (${branch})`;
					const sessionName = ctx.sessionManager.getSessionName();
					if (sessionName) pwd = `${pwd} • ${sessionName}`;

					// Layout: left stats + right-aligned model
					const leftWidth = visibleWidth(left);
					const rightWidth = visibleWidth(right);
					const pad = " ".repeat(Math.max(2, width - leftWidth - rightWidth));
					const statsLine = left + pad + right;

					const dimLeft = theme.fg("dim", left);
					const dimRight = theme.fg("dim", pad + right);

					const pwdLine = truncateToWidth(theme.fg("dim", pwd), width, theme.fg("dim", "..."));

					const lines = [pwdLine, dimLeft + dimRight];

					// Extension statuses
					const statuses = footerData.getExtensionStatuses();
					if (statuses.size > 0) {
						const statusLine = Array.from(statuses.entries())
							.sort(([a], [b]) => a.localeCompare(b))
							.map(([, text]) => text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim())
							.join(" ");
						lines.push(truncateToWidth(statusLine, width, theme.fg("dim", "...")));
					}

					return lines;
				},
			};
		});
	});
}
