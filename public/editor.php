<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Narrascript Builder</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <link rel="stylesheet" href="editor_styles.css">
</head>
<body>

<header class="editor-topbar">
    <div class="topbar-left">
        <span class="editor-title">Narrascript Builder</span>
        <button type="button" data-action="change-panels">Change Panels</button>

        <div class="layout-menu" data-layout-menu hidden>
            <div class="layout-options" data-layout-options>
                <!-- generated buttons -->
            </div>
            <div class="layout-boxes">
                <label class="layout-option" data-option="vertical" hidden>
                    <input type="checkbox" data-option-input="vertical"><span>Vertical?</span>
                </label>
                <label class="layout-option" data-option="reverse" hidden>
                    <input type="checkbox" data-option-input="reverse"><span>Inverse?</span>
                </label>
            </div>
        </div>
    </div>

    <div class="topbar-middle">
        <button type="button" data-action="new">New</button>
        <button type="button" data-action="download">Download</button>
        <button type="button" data-action="load">Load</button>
    </div>

    <div class="topbar-right">
        <button type="button" data-action="docs">Documentation</button>
    </div>
</header>

<main class="editor-main">
    <section class="editor-grid">
        <?php
        for ($i = 0; $i < 4; $i++) {
            echo('
            <label class="field slot-'.($i+1).'" data-editor-slot="'.$i.'">
                <input type="text" aria-hidden="true" tabindex="-1" style="position:absolute; opacity:0; pointer-events:none;">
                <div class="field-header">
                <span class="field-label">-</span>
                <div class="field-tools">
                    <button type="button" data-slot-action="clear">Clear</button>
                    <button type="button" data-slot-action="rename">Rename</button>
                    <button type="button" data-slot-action="add-child">+ Child</button>
                </div>
                </div>
                <textarea placeholder="Object properties"></textarea>
                <span class="field-error"></span>
            </label>
            ');
        }
        ?>
    </section>
</main>

<footer class="editor-object-bar">
    <button type="button" class="object-toggle" data-action="toggle-objects">Objects ↑</button>
    <div class="object-panel" hidden>
        <div data-object-list></div>
    </div>
</footer>

<script type="module" src="editor.js"></script>

</body>
</html>
