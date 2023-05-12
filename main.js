const modelSpecification = `
% Constants
int: number_of_teams;
int: min_for_permanency_or_tour;
int: max_for_permanency_or_tour;
int: number_of_dates = (2*(number_of_teams-1));

set of int: teams_in_negative = -1*number_of_teams..-1;
set of int: teams = 1..number_of_teams;
set of int: dates = 1..number_of_dates;
set of int: calendar_values = teams_in_negative union teams;

array[teams,teams] of int: distance_per_team;


% Decision variables
array [dates, teams] of var calendar_values: calendar_of_matches;

% Constraints

% all local matches are match with a visitor match seems OK
constraint forall(date in dates, team in teams)( 
      if calendar_of_matches[date,team] > 0 then 
        calendar_of_matches[date,abs(calendar_of_matches[date,team])] == team*-1 
      
      else
        calendar_of_matches[date,abs(calendar_of_matches[date,team])] == team
     
      endif
);


% for all dates half the matches are local and half visitors seems OK 
constraint forall(date in dates)(
      sum(team in teams)(bool2int(calendar_of_matches[date, team] in teams)) == 
      sum(team in teams)(bool2int(calendar_of_matches[date, team] in teams_in_negative)) /\\
      sum(team in teams)(bool2int(calendar_of_matches[date, team] in teams)) == number_of_teams/2
);

% there has to be a match as local and as visitor seems OK 
constraint forall(team in teams)(
      forall(k in teams where k != team)(
            exists(date_one in dates, date_two in dates)(
              calendar_of_matches[date_one,team] == k /\\ calendar_of_matches[date_two,team] == -1*k
            )
      )
);

% a tour is in the correct range
constraint forall(team in teams)(
    exists(first_date in dates,add in 0..number_of_dates-1 where first_date+add in dates)(
      forall(date in first_date..first_date+add)(
        calendar_of_matches[date,team] < 0 
      ) /\\
      add+1 >= min_for_permanency_or_tour /\\
      add+1 <= max_for_permanency_or_tour
    ) 
);

% in two consecutives dates there cannot be the same match seems ok
constraint forall(date in 1..number_of_dates-1, team in teams)( 
     abs(calendar_of_matches[date,team]) != abs(calendar_of_matches[date+1,team])
);


% Objective
var int: expenses;

constraint expenses = sum(date in dates, team in teams)(
  if not (date+1 in dates) \\/  date == 1 then
    if calendar_of_matches[date,team] < 0 then
      distance_per_team[abs(calendar_of_matches[date,team]),team]
      
    else
      distance_per_team[team,team] 
      
    endif
    
  elseif calendar_of_matches[date,team] > 0 /\\ calendar_of_matches[date+1,team] < 0 then
    distance_per_team[abs(calendar_of_matches[date+1,team]),team]
    
  elseif calendar_of_matches[date,team] < 0 /\\ calendar_of_matches[date,team] != calendar_of_matches[date+1,team] then
    distance_per_team[abs(calendar_of_matches[date+1,team]) ,abs(calendar_of_matches[date,team])] 
  
  else
    distance_per_team[team,team] 
  
  endif
);

solve minimize expenses;
         

` 

const READY_STATUS = "Ready!"
const FAILURE_STATUS = "Something went wrong, try again ✗"
const LOADING_STATUS = "Loading..⧗"
const SUCCESS_STATUS = "Success ✓"

const ERRINVALIDFILEFORMAT = "error invalid file format"

let instancesRunning = 0

async function runModel(event){
    event.preventDefault()

    if (instancesRunning > 0)  {
      window.alert("Only one model can be running at a time")

      return 
    }

    instancesRunning += 1

    showMessageForStatus("")
    clearOutput()

    try {
        model = await getModelReady()
        solveModel(model)

    } catch (e) {
        instancesRunning = 0
        showMessageForStatus("failure")
        console.error(e)
        if ( e === ERRINVALIDFILEFORMAT){
          window.alert(ERRINVALIDFILEFORMAT)
        }
    } 
}

async function getModelReady(){
    const fileInput = document.getElementById("modelFileInput")
    const modelData = await fileInput.files[0].text()


    let res = translateInput(modelData)
    if (res === ERRINVALIDFILEFORMAT){
      throw ERRINVALIDFILEFORMAT
    }
    
    const model = new MiniZinc.Model();

    model.addDznString(res);
    model.addFile('model.mzn', modelSpecification);

    return model
}

function solveModel(model){
    const solve = model.solve({
        options: {
          solver: 'gecode',
          'all-solutions': true
        }
    });

    showMessageForStatus("loading")
    
    stopAfterTime(solve)
    
    handleError(solve)

    handleSuccess(solve)
}


function showMessageForStatus(status){
    const statusElement = document.getElementById("status")

    statusElement.classList.remove("terminal-alert-primary", "terminal-alert-error")

    switch (status) {
        case "success":
            statusElement.innerText = SUCCESS_STATUS
            statusElement.classList.add("terminal-alert-primary")

            break;
        case "loading":
            statusElement.innerText = LOADING_STATUS

            break;
        
        case "failure":
            statusElement.innerText = FAILURE_STATUS
            statusElement.classList.add("terminal-alert-error")

            break;
    
        default:
            statusElement.innerText = READY_STATUS

            break;
    }
}


function showOutput(output){
    const codeOutput = document.getElementById("codeOutput")

    calendar = []
    for(row in output.result.calendar_of_matches)  {
        ca = JSON.stringify(output.result.calendar_of_matches[row])
        calendar.push(ca)
    }
  
    output.result.calendar_of_matches = calendar
    const myHtml = hljs.highlight(JSON.stringify(output, null, 2), { language: 'json' }).value
    codeOutput.innerHTML = myHtml
}

function clearOutput(){
    const codeOutput = document.getElementById("codeOutput")
    codeOutput.innerHTML = ""
}

function stopAfterTime(solve) { // stop the model after 1 minute
  setTimeout(() => {
    if (solve.isRunning()) {
        try {
            solve.cancel();
        }catch(e){
            instancesRunning = 0
            console.error(e)
        }
        showMessageForStatus("failure")
        window.alert("Model stoped, took more than 1 minute")            
    }
  }, 60000); 
}

function handleError(solve){
  solve.on('error', e => {
    showMessageForStatus("failure")
    console.error(e)
    try {
        solve.cancel();
    }catch(e){
        instancesRunning = 0
        console.error(e)
    }
});
}

function handleSuccess(solve){
  solve.then(result => {
    instancesRunning = 0 //important so other models can be run, it must be present if an error ocurrs inside a promise
    
    showMessageForStatus("success")
 
    showOutput({
      status: result.status,
      result: result.solution?.output?.json
    })
});
}

function translateInput(input){
  rows = getRowsReady(input)

  if (rows.length <= 3){
    return ERRINVALIDFILEFORMAT
  }


  let threeFirstValues = getThreeFirstValues(rows)
  if (threeFirstValues === ERRINVALIDFILEFORMAT){
    return ERRINVALIDFILEFORMAT
  }

  let numberOfTeams = getInteger(threeFirstValues[0])

  if (rows.length < 3 + numberOfTeams ){
    return ERRINVALIDFILEFORMAT
  }

  let teamsCosts = getTeamCosts(rows, numberOfTeams)
  if (teamsCosts === ERRINVALIDFILEFORMAT){
    return ERRINVALIDFILEFORMAT
  }

  return translateToMinizinc(threeFirstValues, teamsCosts)
}


function getRowsReady(input){
  input = input.trim()
  let rows = input.split(/\r\n|\n/)

  for(let i =0; i < rows.length; i++){
    rows[i] = rows[i].trim()
  }

  return rows
}

function getInteger(input){
  let number = parseInt(input)

  if ( isNaN(number) || number < 0 || !Number.isInteger(number) ) {
    return ERRINVALIDFILEFORMAT
  }

  return number
}

function getThreeFirstValues(rows){
  let vals = []

  for (let i = 0; i < 3; i++){
    let number = getInteger(rows[i])
    if (number === ERRINVALIDFILEFORMAT){
      return ERRINVALIDFILEFORMAT
    }

    vals.push(number)
  }

  return vals
}

function getTeamCosts(rows, numberOfTeams){
  costs = []

  for(let i = 3; i < rows.length; i++ ){
    let row = rows[i]

    let columns = row.split(" ")
    if (columns.length < numberOfTeams){
      return ERRINVALIDFILEFORMAT
    }

    let costsRow = []
    for(let j = 0; j < columns.length; j++){
      let number = getInteger(columns[j])
      if (number === ERRINVALIDFILEFORMAT){
        return ERRINVALIDFILEFORMAT
      }
  
      costsRow.push(number)
    }

    costs.push(costsRow)
  }

  return costs
}

function translateToMinizinc(threeFirstRows, costs){
  let distancePerTeam = `[`
  
  for (let i = 0; i < costs.length; i++) {
    const row = costs[i];

    let rowValue = `|`
    for (let j = 0; j < row.length; j++) {
      const col = row[j];
      rowValue += ` ${col},`
    }

    rowValue += '\n'
    distancePerTeam += rowValue
  }

  distancePerTeam += ' |]'

  return   `number_of_teams = ${threeFirstRows[0]};
  min_for_permanency_or_tour = ${threeFirstRows[1]};
  max_for_permanency_or_tour = ${threeFirstRows[2]};
  distance_per_team = ${distancePerTeam};
  `
}