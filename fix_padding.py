import sys

with open('src/modules/home/dashboard/CalendarMonth.vue', 'r') as f:
    content = f.read()

old_str = """.today-bubble-item {
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
}"""

new_str = """.today-bubble-item {
  position: relative;
  min-width: 0;
  border: 1px solid rgba(226, 232, 240, 0.6);
  border-radius: 12px;
  background: #ffffff;
  padding: 10px 12px 10px 32px;
  display: flex;
  gap: 8px;
  align-items: flex-start;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 2px 8px -4px rgba(100, 116, 139, 0.1);
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}"""

if old_str in content:
    content = content.replace(old_str, new_str)
    with open('src/modules/home/dashboard/CalendarMonth.vue', 'w') as f:
        f.write(content)
    print("Replaced successfully")
else:
    print("Could not find the target string")
