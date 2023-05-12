# caldep-solver
model for solving the caldep folder TODO add link here to problem description

# Files
| files                      | usage                                                                                        |
|----------------------------|----------------------------------------------------------------------------------------------|
| bootstrap-grid.min.css     | library used for css                                                                         |
| bootstrap-grid.min.css.map | library used for css                                                                         |
| styles.css                 | custom styles for better user experience                                                     |
| index.html                 | defines presentation template                                                                |
| LICENSE                    | defines license                                                                              |
| main.js                    | main logic, in charge of executing the provided data to the model and presenting the results |
| CalDep.mzn                 | model definition available to use in minizinc                                                |

NOTE CalDep.mzn  model must be parsed in order to use in the webpage, as it is currently harcoded in main.js

# How to execute
- Open the current index.html file in a web browser or visit (https://rojbar.github.io/caldep-solver/)
- Load a valid input file
- Click on run model

# Libraries used
- Bootstrap
- Terminal.css
- Highlight.js