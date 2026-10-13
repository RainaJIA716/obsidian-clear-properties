import { MarkdownView, Notice, Plugin, TFile, getFrontMatterInfo, getLanguage, setIcon, setTooltip } from "obsidian";

const BAR_CLASS = "clear-properties-bar";

const STRINGS = {
	en: {
		clearAll: "Delete all properties",
		command: "Delete all properties of current note",
		none: "This note has no properties",
		cleared: (n: number) => `Deleted ${n} ${n === 1 ? "property" : "properties"}`,
		undo: "Undo",
		restored: "Properties restored",
		cannotRestore: "The note already has properties again, so nothing was restored",
		failed: "Could not delete the properties; the note was not changed",
	},
	zh: {
		clearAll: "删除全部属性",
		command: "删除当前笔记的全部属性",
		none: "这篇笔记没有属性",
		cleared: (n: number) => `已删除 ${n} 个属性`,
		undo: "撤销",
		restored: "属性已恢复",
		cannotRestore: "笔记里已经又有属性了，没有恢复",
		failed: "没能删除属性，笔记没有改动",
	},
};

// 跟随 Obsidian 的界面语言
const t = getLanguage().startsWith("zh") ? STRINGS.zh : STRINGS.en;

/** 文首的属性块，连同它后面紧跟的空行一起算；没有属性块返回 null */
function findBlock(text: string): { end: number; count: number } | null {
	const info = getFrontMatterInfo(text);
	if (!info.exists) return null;
	let end = info.contentStart;
	const rest = /^(?:[ \t]*\r?\n)*/.exec(text.slice(end));
	if (rest) end += rest[0].length;
	// 只数顶格的 key，列表项和多行值不算
	const count = info.frontmatter.split(/\r?\n/).filter((l) => /^[^\s#-][^:]*:/.test(l)).length;
	return { end, count };
}

export default class ClearPropertiesPlugin extends Plugin {
	private observers = new Set<ResizeObserver>();

	async onload() {
		this.app.workspace.onLayoutReady(() => this.addBars());
		this.registerEvent(this.app.workspace.on("layout-change", () => this.addBars()));
		this.registerEvent(this.app.workspace.on("file-open", () => this.addBars()));
		// 原本没有属性的笔记，加了属性之后属性区才出现
		this.registerEvent(this.app.metadataCache.on("changed", () => this.addBars()));

		this.addCommand({
			id: "clear-properties",
			name: t.command,
			icon: "eraser",
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view?.file) return false;
				if (!checking) void this.clear(view);
				return true;
			},
		});
	}

	onunload() {
		this.observers.forEach((ro) => ro.disconnect());
		this.observers.clear();
		// 注入到原生属性区的竖条不会随插件卸载自动消失，要自己收回（按 leaf 找，弹出窗口里的也能收到）
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			leaf.view.containerEl.querySelectorAll(`.${BAR_CLASS}`).forEach((el) => el.remove());
		}
	}

	/** 给每个笔记里的属性区（编辑模式和阅读模式各有一个）加上左侧竖条 */
	private addBars() {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) continue;
			view.containerEl.querySelectorAll<HTMLElement>(".metadata-container > .metadata-content").forEach((content) => {
				if (content.querySelector(`:scope > .${BAR_CLASS}`)) return;
				const bar = content.createDiv({ cls: BAR_CLASS, attr: { role: "button", "aria-label": t.clearAll } });
				setIcon(bar.createSpan({ cls: `${BAR_CLASS}-icon` }), "trash-2");
				setTooltip(bar, t.clearAll, { placement: "left" });
				// 竖条和属性列表一样高（不含底部「+ 添加属性」那一行），各种主题下都对得齐
				const list = content.querySelector<HTMLElement>(":scope > .metadata-properties");
				if (list) {
					const fit = () => {
						bar.style.top = `${list.offsetTop}px`;
						bar.style.height = `${list.offsetHeight}px`;
					};
					const ro = new ResizeObserver(fit);
					ro.observe(list);
					this.observers.add(ro);
					fit();
				}
				bar.addEventListener("click", (evt) => {
					evt.preventDefault();
					evt.stopPropagation();
					void this.clear(view);
				});
			});
		}
	}

	private async clear(view: MarkdownView) {
		const file = view.file;
		if (!file) return;
		try {
			const result = view.getMode() === "source" ? this.clearInEditor(view) : await this.clearOnDisk(view, file);
			if (!result) {
				new Notice(t.none);
				return;
			}
			this.notifyCleared(view, file, result.removed, result.count);
		} catch (e) {
			new Notice(e instanceof Error ? e.message : String(e));
		}
	}

	/** 编辑模式：编辑器里的文本才是最新的（可能还没存盘），而且这样改能用 ⌘Z 撤销 */
	private clearInEditor(view: MarkdownView): { removed: string; count: number } | null {
		const editor = view.editor;
		const text = editor.getValue();
		const block = findBlock(text);
		if (!block) return null;
		const rest = text.slice(block.end);
		// 不能用 replaceRange：属性以面板显示时，Obsidian 会拦下删到属性块末尾的编辑（防误删 ---），
		// 而且拦不拦取决于光标位置。setValue 不受这个限制，同样能 ⌘Z 撤销
		const scroll = editor.getScrollInfo();
		editor.setValue(rest);
		editor.scrollTo(scroll.left, scroll.top);
		if (editor.getValue() !== rest) throw new Error(t.failed);
		return { removed: text.slice(0, block.end), count: block.count };
	}

	/** 阅读模式：改编辑器不会存盘也不会刷新画面，所以先把编辑器存盘，再直接改文件 */
	private async clearOnDisk(view: MarkdownView, file: TFile): Promise<{ removed: string; count: number } | null> {
		await view.save();
		let result: { removed: string; count: number } | null = null;
		await this.app.vault.process(file, (text) => {
			const block = findBlock(text);
			if (!block) return text;
			result = { removed: text.slice(0, block.end), count: block.count };
			return text.slice(block.end);
		});
		return result;
	}

	/** 提示里带「撤销」：阅读模式和手机上不方便按 ⌘Z */
	private notifyCleared(view: MarkdownView, file: TFile, removed: string, count: number) {
		const frag = createFragment((f) => {
			f.appendText(t.cleared(count) + "  ");
			const link = f.createEl("a", { text: t.undo, href: "#" });
			link.addEventListener("click", (evt) => {
				evt.preventDefault();
				notice.hide();
				void this.restore(view, file, removed);
			});
		});
		const notice = new Notice(frag, 8000);
	}

	private async restore(view: MarkdownView, file: TFile, removed: string) {
		try {
			if (view.file === file && view.getMode() === "source") {
				const editor = view.editor;
				if (findBlock(editor.getValue())) throw new Error(t.cannotRestore);
				editor.replaceRange(removed, { line: 0, ch: 0 });
			} else {
				await this.app.vault.process(file, (text) => {
					if (findBlock(text)) throw new Error(t.cannotRestore);
					return removed + text;
				});
			}
			new Notice(t.restored);
		} catch (e) {
			new Notice(e instanceof Error ? e.message : String(e));
		}
	}
}
