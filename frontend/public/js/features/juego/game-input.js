export function bindBatInput(button, { signal, swing, active = () => !button.hidden }) {
    // A native button unifies pointer/touch/assistive activation. Space/Enter
    // outside inputs are handled once; prevent their synthesized native click.
    button.addEventListener('click',() => { if (active() && !button.disabled) swing(); },{signal});
    const keydown = event => {
        if (!active() || !['Space','Enter'].includes(event.code) || event.ctrlKey || event.altKey || event.metaKey) return;
        const target = event.target;
        if (target !== button && target?.closest?.('input,select,textarea,button,a,[contenteditable="true"],dialog')) return;
        if (document.querySelector('dialog[open]')) return;
        event.preventDefault();
        if (event.repeat) return;
        if (!button.disabled && !button.hidden) swing();
    };
    window.addEventListener('keydown',keydown,{signal});
}
