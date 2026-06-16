import sys

with open('src/modules/home/dashboard/CalendarMonth.vue', 'r') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if '.today-bubble {' in line and start_idx == -1:
        start_idx = i
        break

for i in range(len(lines)-1, -1, -1):
    if '@media (max-width: 1180px)' in lines[i]:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    new_css = """
.today-bubble {
  position: absolute;
  z-index: 30;
  top: -8px;
  left: calc(100% + 10px);
  width: 300px;
  max-height: min(420px, calc(100vh - 150px));
  box-sizing: border-box;
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 20px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 100%);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.5) inset,
    0 10px 40px -10px rgba(37, 99, 235, 0.15),
    0 24px 64px -24px rgba(15, 23, 42, 0.2);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  cursor: default;
  backdrop-filter: blur(20px) saturate(160%);
  isolation: isolate;
  overflow: visible;
  animation: bubble-pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  transform-origin: left center;
}

@keyframes bubble-pop-in {
  from { opacity: 0; transform: scale(0.9) translateX(-10px); }
  to { opacity: 1; transform: scale(1) translateX(0); }
}

.day-cell.is-bubble-left .today-bubble {
  right: calc(100% + 10px);
  left: auto;
  transform-origin: right center;
  animation-name: bubble-pop-in-left;
}

@keyframes bubble-pop-in-left {
  from { opacity: 0; transform: scale(0.9) translateX(10px); }
  to { opacity: 1; transform: scale(1) translateX(0); }
}

.day-cell.is-bubble-up .today-bubble {
  top: auto;
  bottom: -8px;
}

/* Elegant CSS triangle arrow */
.today-bubble::before {
  content: '';
  position: absolute;
  top: 32px;
  left: -7px;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 7px 7px 7px 0;
  border-color: transparent #ffffff transparent transparent;
  filter: drop-shadow(-1px 0 1px rgba(59, 130, 246, 0.15));
  z-index: 10;
}

.day-cell.is-bubble-up .today-bubble::before {
  top: auto;
  bottom: 32px;
}

.day-cell.is-bubble-left .today-bubble::before {
  left: auto;
  right: -7px;
  border-width: 7px 0 7px 7px;
  border-color: transparent transparent transparent #f8fafc;
  filter: drop-shadow(1px 0 1px rgba(59, 130, 246, 0.15));
}

.today-bubble header {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.today-bubble-title {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.today-bubble-title strong {
  color: #0f172a;
  font-size: 18px;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: -0.3px;
  background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.today-bubble-title span {
  width: fit-content;
  height: 24px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(167, 139, 250, 0.1));
  color: #3b82f6;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 800;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.today-bubble header button {
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.6);
  color: #64748b;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.today-bubble header button:hover {
  background: #fecaca;
  color: #ef4444;
  transform: scale(1.15) rotate(90deg);
}

.today-bubble-list {
  min-height: 100px;
  flex: 1 1 auto;
  max-height: none;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: 12px;
  overscroll-behavior: contain;
  padding: 2px;
}

.today-bubble-list::-webkit-scrollbar {
  width: 4px;
}
.today-bubble-list::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 4px;
}

.today-bubble-item {
  position: relative;
  min-width: 0;
  border: 1px solid rgba(226, 232, 240, 0.6);
  border-radius: 12px;
  background: #ffffff;
  padding: 10px 12px 10px 32px;
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 2px 8px -4px rgba(100, 116, 139, 0.1);
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.today-bubble-item:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
  box-shadow: 0 6px 16px -6px rgba(59, 130, 246, 0.2);
}

.today-bubble-item.is-rejected {
  background: rgba(254, 242, 242, 0.6);
  border-color: rgba(252, 165, 165, 0.4);
}

.today-bubble-item.is-rejected:hover {
  background: rgba(254, 226, 226, 0.8);
  border-color: rgba(248, 113, 113, 0.6);
}

.today-bubble-item.is-rejected::before {
  background: #ef4444;
  box-shadow: 0 0 8px 1px rgba(239, 68, 68, 0.4);
}

.today-bubble-item::before {
  position: absolute;
  left: 12px;
  top: 50%;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #3b82f6;
  content: '';
  transform: translateY(-50%);
  box-shadow: 0 0 8px 2px rgba(59, 130, 246, 0.3);
  transition: all 0.2s ease;
}

.today-bubble-item:hover::before {
  transform: translateY(-50%) scale(1.2);
  box-shadow: 0 0 10px 3px rgba(59, 130, 246, 0.4);
}

.today-bubble-item-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.today-bubble-item-content time {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}

.today-bubble-item-content span {
  color: #1e293b;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.today-bubble-item-content span em {
  color: #ef4444;
  font-style: normal;
  font-weight: 800;
  font-size: 11px;
  background: rgba(254, 226, 226, 0.8);
  padding: 2px 6px;
  border-radius: 6px;
  margin-left: 4px;
}

.today-bubble-empty {
  margin: 0;
  flex: 1;
  min-height: 84px;
  border: 1.5px dashed rgba(147, 197, 253, 0.8);
  border-radius: 12px;
  background: rgba(239, 246, 255, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px;
  text-align: center;
  transition: all 0.2s ease;
}

.today-bubble-empty:hover {
  background: rgba(239, 246, 255, 0.8);
  border-color: #60a5fa;
  transform: scale(1.02);
}

.empty-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #eff6ff;
  color: #60a5fa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.today-bubble-empty p {
  margin: 0;
  color: #3b82f6;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 800;
}

.today-quick-create {
  position: relative;
  flex: 0 0 auto;
  min-height: 42px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.today-quick-create input {
  width: 100%;
  height: 42px;
  box-sizing: border-box;
  border: 1px solid rgba(203, 213, 225, 0.8);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  padding: 0 16px;
  color: #0f172a;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  outline: none;
  box-shadow: 0 2px 10px -4px rgba(100, 116, 139, 0.1);
  transition: all 0.2s ease;
}

.today-quick-create input::placeholder {
  color: #94a3b8;
  font-weight: 500;
}

.today-quick-create input:focus {
  background: #ffffff;
  border-color: #3b82f6;
  box-shadow:
    0 4px 14px -4px rgba(59, 130, 246, 0.2),
    0 0 0 3px rgba(59, 130, 246, 0.15);
}

.today-quick-create.has-value input {
  padding-right: 90px;
}

.ai-submit-btn {
  position: absolute;
  right: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  color: white;
  font-size: 12px;
  font-weight: 600;
  border: none;
  display: flex;
  align-items: center;
  cursor: pointer;
  box-shadow: 0 4px 12px -4px rgba(59, 130, 246, 0.5);
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.ai-submit-btn:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 6px 16px -4px rgba(59, 130, 246, 0.6);
}

"""
    lines = lines[:start_idx] + [new_css] + lines[end_idx:]
    with open('src/modules/home/dashboard/CalendarMonth.vue', 'w') as f:
        f.writelines(lines)
    print("Replaced successfully")
else:
    print(f"Could not find start or end index: {start_idx}, {end_idx}")
