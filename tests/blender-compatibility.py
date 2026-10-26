"""Execute the helper's presentation code against strict Blender API doubles.

No Blender dependency; this does not certify actual imports or rendering.
An optional source path supports negative regression probes outside the repo.
"""
import ast
import sys
from pathlib import Path
from types import SimpleNamespace as NS

source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'public/shared/open_in_blender.py'
module = ast.parse(source.read_text())
functions = {node.name: node for node in module.body if isinstance(node, ast.FunctionDef)}
initial_engine = [node for node in ast.walk(functions['main'])
                  if isinstance(node, ast.Assign) and any(
                      ast.unparse(target) == 'scene.render.engine' for target in node.targets)]
assert len(initial_engine) == 1, 'Exercise the initial engine selection as well as publication settings'


class Render:
    def __init__(self, version):
        self.version = version
        self.use_compositing = True
        self.film_transparent = True
        self.image_settings = NS(color_mode='RGBA')

    @property
    def engine(self):
        return self._engine

    @engine.setter
    def engine(self, value):
        eevee = 'BLENDER_EEVEE_NEXT' if (4, 2, 0) <= self.version < (5, 0, 0) else 'BLENDER_EEVEE'
        assert value in ('CYCLES', eevee, 'BLENDER_WORKBENCH'), f'Unavailable engine: {value} on {self.version}'
        self._engine = value


class Nodes(list):
    def new(self, kind):
        assert kind in ('CompositorNodeRLayers', 'CompositorNodeAlphaOver', 'CompositorNodeComposite')
        node = NS(kind=kind, inputs={key: NS(default_value=None) for key in (0, 1, 2, 'Image')},
                  outputs={'Image': object()})
        self.append(node)
        return node


class Scene:
    def __init__(self, version):
        self.version = version
        self.render = Render(version)
        self.cycles = NS()
        self.view_settings = NS()
        self.background = NS(inputs={key: NS(default_value=None) for key in ('Color', 'Strength')})
        self.world = NS(node_tree=NS(nodes=NS(get=lambda name: self.background)))
        self.links = []
        self.tree = NS(nodes=Nodes(), links=NS(new=lambda a, b: self.links.append((a, b))))

    @property
    def node_tree(self):
        assert self.version < (5, 0, 0), 'Removed scene.node_tree accessed on Blender 5.x'
        return self.tree

    @property
    def use_nodes(self):
        return self._use_nodes

    @use_nodes.setter
    def use_nodes(self, value):
        assert self.version < (5, 0, 0), 'Legacy compositor enabled on Blender 5.x'
        self._use_nodes = value


for version in ((3, 6, 0), (4, 5, 3), (5, 0, 0), (5, 2, 2)):
    scene = Scene(version)
    namespace = {'bpy': NS(app=NS(version=version), data=NS(collections=NS(get=lambda name: None))),
                 'scene': scene, 'sys': NS(argv=[])}
    # Execute code extracted from the canonical helper, not a copied implementation.
    exec(compile(ast.Module(body=initial_engine + [functions['publication_settings']], type_ignores=[]),
                 str(source), 'exec'), namespace)
    assert scene.render.engine == 'CYCLES', 'Initial engine must match the publication renderer'
    namespace['publication_settings'](scene)
    assert scene.render.engine == 'CYCLES'
    assert scene.cycles.samples == 64 and scene.cycles.use_denoising is False
    assert scene.view_settings.view_transform == 'Standard'
    if version >= (5, 0, 0):
        assert scene.render.use_compositing is False and scene.render.film_transparent is False
        assert scene.render.image_settings.color_mode == 'RGB'
        assert scene.background.inputs['Color'].default_value == (1, 1, 1, 1)
        assert scene.background.inputs['Strength'].default_value == .8
        assert not scene.tree.nodes and not scene.links
    else:
        assert scene.use_nodes and scene.render.use_compositing and scene.render.film_transparent
        assert scene.render.image_settings.color_mode == 'RGBA'
        assert [node.kind for node in scene.tree.nodes] == ['CompositorNodeRLayers', 'CompositorNodeAlphaOver', 'CompositorNodeComposite']
        layer, over, output = scene.tree.nodes
        assert over.inputs[0].default_value == 1 and over.inputs[1].default_value == (1, 1, 1, 1)
        assert scene.links == [(layer.outputs['Image'], over.inputs[2]), (over.outputs['Image'], output.inputs['Image'])]
        assert scene.background.inputs['Color'].default_value == (.8, .8, .8, 1)
    print('PASS Blender API double', '.'.join(map(str, version)), '(not an actual Blender execution)')
