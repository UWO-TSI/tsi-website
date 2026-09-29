# Open live Blender with the MCP bridge listening on localhost:9876, for modeling driven through the
# `blender` MCP tools with viewport reviews (avatar v7, row 254):
#   /Applications/Blender.app/Contents/MacOS/Blender art/characters/v7/<file>.blend --python art/characters/blender_mcp_autostart.py
import sys
import addon_utils
import bpy

addon_utils.enable("blender_mcp", default_set=True, persistent=True)


def start():
    scene = bpy.context.scene
    scene.blendermcp_auto_start_server = True
    module = sys.modules.get("blender_mcp")
    if module is not None:
        module._blendermcp_ensure_server_running()
    return None


bpy.app.timers.register(start, first_interval=1.0)
