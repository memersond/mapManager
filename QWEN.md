This project will be a game. The game will be mostly management and data driven.

The main game board will be a randomly generated terrain on a 2d grid. Each cell will have a base terrain like sand, grass or stone that should fluctuate with elevation. Base terrain can provide some very small amount of resources like wood from grasslands, stone from stonelands, possibly nothing from sand, but players could fish on the coast. 

Cells can also have a somewhat rare secondary resource like ore for example. 

Each cell has a movment cost associated with it, though there will not be an specific people running logistics, the distance between areas will dictate how long it takes to transfer resources. 

The maps should be scrollable with middle mouse and zoomable with mouse wheel. Similarly scrollable with WASD and zommable with Q and E.

In order to build anything on the map to gather resources, you  must place an outpost. Building can only be done within the range of the outpost. More outposts can be built, or existing outpost can eventually size up with population and tech avancements.

You must also build housing for citizens to keep capacity and provide them enough food though hunting or farming to survive. 

Seasons will change, depending on climate, possibly making survivial or growing food harder. 

The goal is to grow your civilization as much as possible while keeping your citizens happy and eventually managing politics.


Code style should use camelCase for variables, SCREAM_CASE for constants. We want to target a modular event driven component architecture, so things stay flexible. 

Decisions and high points of the code should be documented in a docs/ folder that will be an Obsidian vault containing markdown documents. 